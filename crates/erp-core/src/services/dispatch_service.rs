use crate::entities::{customer, dispatch, dispatch_item, reel};
use crate::error::{AppError, AppResult};
use crate::services::{reel_service, stock_service};
use chrono::{NaiveDateTime, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set, TransactionTrait,
};
use uuid::Uuid;

pub struct DispatchItemInput {
    pub product_id: Uuid,
    pub quantity: f64,
    pub weight_kg: Option<f64>,
}

pub struct CreateDispatchInput {
    pub invoice_number: String,
    pub customer_id: Uuid,
    pub vehicle_number: Option<String>,
    pub driver_name: Option<String>,
    pub driver_phone: Option<String>,
    pub dispatch_date: NaiveDateTime,
    pub remarks: Option<String>,
    pub items: Vec<DispatchItemInput>,
    /// Physical reel numbers being sent out with this dispatch. Each must
    /// currently be `in_stock`; on success they all become `dispatched`
    /// and are linked to this dispatch's customer.
    pub reel_numbers: Vec<String>,
}

/// Creates a dispatch, its line items, the corresponding stock outward
/// movements, and the reel status transitions -- all inside one
/// transaction. This is deliberately all-or-nothing: a dispatch that
/// claims to send 500 units but only decrements stock for 300 (because a
/// later item failed validation) would corrupt the stock ledger in a way
/// that's hard to detect and worse to unwind by hand.
pub async fn create(
    db: &DatabaseConnection,
    input: CreateDispatchInput,
    performed_by: Uuid,
) -> AppResult<dispatch::Model> {
    if input.invoice_number.trim().is_empty() {
        return Err(AppError::Validation("invoice number is required".into()));
    }
    if input.items.is_empty() && input.reel_numbers.is_empty() {
        return Err(AppError::Validation(
            "a dispatch must include at least one product line item or reel".into(),
        ));
    }
    for item in &input.items {
        if item.quantity <= 0.0 {
            return Err(AppError::Validation(
                "dispatch item quantity must be greater than zero".into(),
            ));
        }
    }

    let invoice_taken = dispatch::Entity::find()
        .filter(dispatch::Column::InvoiceNumber.eq(input.invoice_number.clone()))
        .one(db)
        .await?
        .is_some();
    if invoice_taken {
        return Err(AppError::Conflict(format!(
            "a dispatch with invoice number '{}' already exists",
            input.invoice_number
        )));
    }

    let customer_exists = customer::Entity::find_by_id(input.customer_id)
        .one(db)
        .await?
        .is_some();
    if !customer_exists {
        return Err(AppError::Validation(format!(
            "customer {} does not exist",
            input.customer_id
        )));
    }

    let total_weight_kg: f64 = input
        .items
        .iter()
        .filter_map(|i| i.weight_kg)
        .sum::<f64>();

    let now = Utc::now().naive_utc();
    let dispatch_id = Uuid::new_v4();

    let txn = db.begin().await?;

    let model = dispatch::ActiveModel {
        id: Set(dispatch_id),
        invoice_number: Set(input.invoice_number),
        customer_id: Set(input.customer_id),
        vehicle_number: Set(input.vehicle_number),
        driver_name: Set(input.driver_name),
        driver_phone: Set(input.driver_phone),
        dispatch_date: Set(input.dispatch_date),
        status: Set(crate::domain::DispatchStatus::Pending.as_str().to_string()),
        total_weight_kg: Set(if total_weight_kg > 0.0 {
            Some(total_weight_kg)
        } else {
            None
        }),
        remarks: Set(input.remarks),
        created_by: Set(performed_by),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let created = model.insert(&txn).await?;

    for item in input.items {
        let line = dispatch_item::ActiveModel {
            id: Set(Uuid::new_v4()),
            dispatch_id: Set(dispatch_id),
            product_id: Set(item.product_id),
            quantity: Set(item.quantity),
            weight_kg: Set(item.weight_kg),
        };
        line.insert(&txn).await?;

        stock_service::record_outward_in(
            &txn,
            stock_service::OutwardInput {
                product_id: item.product_id,
                quantity: item.quantity,
                reference_number: Some(created.invoice_number.clone()),
                remarks: None,
                dispatch_id: Some(dispatch_id),
            },
            performed_by,
        )
        .await?;
    }

    for reel_number in input.reel_numbers {
        let reel_model = reel::Entity::find()
            .filter(reel::Column::ReelNumber.eq(reel_number.clone()))
            .one(&txn)
            .await?
            .ok_or_else(|| AppError::Validation(format!("reel '{reel_number}' not found")))?;

        reel_service::dispatch_reel_in(&txn, reel_model.id, input.customer_id, dispatch_id, performed_by)
            .await?;
    }

    txn.commit().await?;
    Ok(created)
}

pub struct DispatchWithDetails {
    pub dispatch: dispatch::Model,
    pub customer_name: String,
    pub items: Vec<dispatch_item::Model>,
    pub reel_numbers: Vec<String>,
}

pub async fn get(db: &DatabaseConnection, id: Uuid) -> AppResult<DispatchWithDetails> {
    let dispatch_model = dispatch::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("dispatch {id} not found")))?;

    let customer_model = customer::Entity::find_by_id(dispatch_model.customer_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("dispatch references a missing customer")))?;

    let items = dispatch_item::Entity::find()
        .filter(dispatch_item::Column::DispatchId.eq(id))
        .all(db)
        .await?;

    let reels = reel::Entity::find()
        .inner_join(crate::entities::reel_movement::Entity)
        .filter(crate::entities::reel_movement::Column::DispatchId.eq(id))
        .all(db)
        .await?;

    Ok(DispatchWithDetails {
        dispatch: dispatch_model,
        customer_name: customer_model.name,
        items,
        reel_numbers: reels.into_iter().map(|r| r.reel_number).collect(),
    })
}

pub struct DispatchFilter {
    pub customer_id: Option<Uuid>,
    pub from: Option<NaiveDateTime>,
    pub to: Option<NaiveDateTime>,
}

pub async fn list(
    db: &DatabaseConnection,
    filter: DispatchFilter,
    page: u64,
    page_size: u64,
) -> AppResult<(Vec<dispatch::Model>, u64)> {
    let mut query = dispatch::Entity::find();

    if let Some(customer_id) = filter.customer_id {
        query = query.filter(dispatch::Column::CustomerId.eq(customer_id));
    }
    if let Some(from) = filter.from {
        query = query.filter(dispatch::Column::DispatchDate.gte(from));
    }
    if let Some(to) = filter.to {
        query = query.filter(dispatch::Column::DispatchDate.lte(to));
    }

    let paginator = query
        .order_by_desc(dispatch::Column::DispatchDate)
        .paginate(db, page_size.max(1));

    let total = paginator.num_items().await?;
    let rows = paginator.fetch_page(page).await?;

    Ok((rows, total))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::services::{auth_service::test_support, customer_service, product_service, reel_service, unit_service};

    struct TestFixture {
        conn: DatabaseConnection,
        dir: std::path::PathBuf,
        product_id: Uuid,
        customer_id: Uuid,
        user: Uuid,
    }

    async fn setup() -> TestFixture {
        let dir = std::env::temp_dir().join(format!("erp-dispatch-test-{}", Uuid::new_v4()));
        let conn = db::init(&dir.join("test.db")).await.unwrap();
        let (_, user) = test_support::seed_test_user(&conn).await;

        let unit = unit_service::create(
            &conn,
            unit_service::CreateUnitInput {
                name: "Piece".into(),
                symbol: "pc".into(),
                conversion_factor: 1.0,
            },
        )
        .await
        .unwrap();

        let product = product_service::create(
            &conn,
            product_service::CreateProductInput {
                sku: "DISP-SKU".into(),
                name: "Dispatch Test Product".into(),
                description: None,
                base_unit_id: unit.id,
                specifications: None,
                reorder_level: 0.0,
            },
        )
        .await
        .unwrap();

        let customer = customer_service::create(
            &conn,
            customer_service::CreateCustomerInput {
                name: "Dispatch Test Customer".into(),
                contact_person: None,
                phone: None,
                email: None,
                address: None,
                gst_number: None,
            },
        )
        .await
        .unwrap();

        stock_service::record_inward(
            &conn,
            stock_service::InwardInput {
                product_id: product.id,
                quantity: 100.0,
                reference_number: None,
                remarks: None,
            },
            user,
        )
        .await
        .unwrap();

        TestFixture {
            conn,
            dir,
            product_id: product.id,
            customer_id: customer.id,
            user,
        }
    }

    #[tokio::test]
    async fn create_dispatch_decrements_stock_and_records_items() {
        let fx = setup().await;

        let created = create(
            &fx.conn,
            CreateDispatchInput {
                invoice_number: "INV-001".into(),
                customer_id: fx.customer_id,
                vehicle_number: Some("KA-01-AB-1234".into()),
                driver_name: Some("Ravi".into()),
                driver_phone: None,
                dispatch_date: Utc::now().naive_utc(),
                remarks: None,
                items: vec![DispatchItemInput {
                    product_id: fx.product_id,
                    quantity: 40.0,
                    weight_kg: Some(20.0),
                }],
                reel_numbers: vec![],
            },
            fx.user,
        )
        .await
        .unwrap();

        assert_eq!(created.invoice_number, "INV-001");
        assert_eq!(created.total_weight_kg, Some(20.0));

        let balances = stock_service::list_balances(&fx.conn).await.unwrap();
        let balance = balances
            .iter()
            .find(|b| b.product.id == fx.product_id)
            .unwrap();
        assert_eq!(balance.quantity_on_hand, 60.0);

        let details = get(&fx.conn, created.id).await.unwrap();
        assert_eq!(details.items.len(), 1);
        assert_eq!(details.customer_name, "Dispatch Test Customer");

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    #[tokio::test]
    async fn create_dispatch_rejects_duplicate_invoice_number() {
        let fx = setup().await;

        let input = || CreateDispatchInput {
            invoice_number: "INV-DUP".into(),
            customer_id: fx.customer_id,
            vehicle_number: None,
            driver_name: None,
            driver_phone: None,
            dispatch_date: Utc::now().naive_utc(),
            remarks: None,
            items: vec![DispatchItemInput {
                product_id: fx.product_id,
                quantity: 5.0,
                weight_kg: None,
            }],
            reel_numbers: vec![],
        };

        create(&fx.conn, input(), fx.user).await.unwrap();
        let second = create(&fx.conn, input(), fx.user).await;
        assert!(matches!(second, Err(AppError::Conflict(_))));

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    #[tokio::test]
    async fn create_dispatch_rolls_back_everything_when_a_reel_is_invalid() {
        let fx = setup().await;

        // A dispatch with one valid item plus one nonexistent reel number
        // must not leave a partial stock outward committed.
        let result = create(
            &fx.conn,
            CreateDispatchInput {
                invoice_number: "INV-ROLLBACK".into(),
                customer_id: fx.customer_id,
                vehicle_number: None,
                driver_name: None,
                driver_phone: None,
                dispatch_date: Utc::now().naive_utc(),
                remarks: None,
                items: vec![DispatchItemInput {
                    product_id: fx.product_id,
                    quantity: 15.0,
                    weight_kg: None,
                }],
                reel_numbers: vec!["NONEXISTENT-REEL".into()],
            },
            fx.user,
        )
        .await;

        assert!(matches!(result, Err(AppError::Validation(_))));

        // Stock should be untouched -- still the original 100.0 from setup.
        let balances = stock_service::list_balances(&fx.conn).await.unwrap();
        let balance = balances
            .iter()
            .find(|b| b.product.id == fx.product_id)
            .unwrap();
        assert_eq!(balance.quantity_on_hand, 100.0);

        // And the dispatch row itself must not exist either.
        let missing = dispatch::Entity::find()
            .filter(dispatch::Column::InvoiceNumber.eq("INV-ROLLBACK"))
            .one(&fx.conn)
            .await
            .unwrap();
        assert!(missing.is_none());

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    #[tokio::test]
    async fn create_dispatch_with_reel_marks_it_dispatched() {
        let fx = setup().await;

        reel_service::register(
            &fx.conn,
            reel_service::RegisterReelInput {
                reel_number: "DISP-REEL-1".into(),
                product_id: fx.product_id,
                weight_kg: Some(10.0),
            },
            fx.user,
        )
        .await
        .unwrap();

        let created = create(
            &fx.conn,
            CreateDispatchInput {
                invoice_number: "INV-REEL".into(),
                customer_id: fx.customer_id,
                vehicle_number: None,
                driver_name: None,
                driver_phone: None,
                dispatch_date: Utc::now().naive_utc(),
                remarks: None,
                items: vec![],
                reel_numbers: vec!["DISP-REEL-1".into()],
            },
            fx.user,
        )
        .await
        .unwrap();

        let details = get(&fx.conn, created.id).await.unwrap();
        assert_eq!(details.reel_numbers, vec!["DISP-REEL-1".to_string()]);

        let reel = reel_service::get_by_reel_number(&fx.conn, "DISP-REEL-1")
            .await
            .unwrap();
        assert_eq!(reel.status, "dispatched");
        assert_eq!(reel.current_customer_id, Some(fx.customer_id));

        let _ = std::fs::remove_dir_all(&fx.dir);
    }
}
