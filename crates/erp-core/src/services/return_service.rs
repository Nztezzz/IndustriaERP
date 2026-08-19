//! Product Return service.
//!
//! A return is linked to a previous dispatch: the customer can return
//! only products that were dispatched to them, up to the dispatched
//! quantity minus any amount already returned. Each successful return
//! records an inward stock movement (with `dispatch_id` set) so the
//! stock balance is automatically restored.

use crate::domain::{DispatchStatus, StockMovementType};
use crate::entities::{dispatch, dispatch_item, stock_movement};
use crate::error::{AppError, AppResult};
use crate::services::stock_service;
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter,
    Set, TransactionTrait,
};
use uuid::Uuid;

pub struct ReturnItemInput {
    pub product_id: Uuid,
    pub quantity: f64,
}

pub struct CreateReturnInput {
    pub dispatch_id: Uuid,
    pub items: Vec<ReturnItemInput>,
    pub remarks: Option<String>,
}

/// Summary of what was returned, for the response.
pub struct ReturnResult {
    pub dispatch_id: Uuid,
    pub items_returned: usize,
}

/// For each product in a dispatch, how much was dispatched and how much
/// has already been returned.
pub struct ReturnableItem {
    pub product_id: Uuid,
    pub dispatched_qty: f64,
    pub already_returned_qty: f64,
    pub returnable_qty: f64,
}

/// Returns the returnable quantities for each line item in a dispatch.
pub async fn get_returnable_items(
    db: &DatabaseConnection,
    dispatch_id: Uuid,
) -> AppResult<Vec<ReturnableItem>> {
    // Verify dispatch exists
    let _dispatch = dispatch::Entity::find_by_id(dispatch_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("dispatch {dispatch_id} not found")))?;

    // Get all line items for this dispatch
    let items = dispatch_item::Entity::find()
        .filter(dispatch_item::Column::DispatchId.eq(dispatch_id))
        .all(db)
        .await?;

    let mut result = Vec::new();

    for item in &items {
        // Find all inward movements linked to this dispatch for this product
        // (these are previous returns)
        let returned_qty = get_returned_qty(db, dispatch_id, item.product_id).await?;

        let returnable = item.quantity - returned_qty;
        result.push(ReturnableItem {
            product_id: item.product_id,
            dispatched_qty: item.quantity,
            already_returned_qty: returned_qty,
            returnable_qty: if returnable > 0.0 { returnable } else { 0.0 },
        });
    }

    Ok(result)
}

/// Sums the quantity of all RETURN movements linked to a specific dispatch
/// and product (i.e. everything already returned for that line item).
///
/// Filters on `movement_type = "return"` specifically -- filtering on
/// "inward" would be wrong now that returns have their own type, and would
/// also wrongly pick up any unrelated inward that happened to carry this
/// dispatch id.
async fn get_returned_qty<C: ConnectionTrait>(
    db: &C,
    dispatch_id: Uuid,
    product_id: Uuid,
) -> AppResult<f64> {
    let movements = stock_movement::Entity::find()
        .filter(stock_movement::Column::DispatchId.eq(dispatch_id))
        .filter(stock_movement::Column::ProductId.eq(product_id))
        .filter(stock_movement::Column::MovementType.eq(StockMovementType::Return.as_str()))
        .all(db)
        .await?;

    Ok(movements.iter().map(|m| m.quantity).sum())
}

/// Recomputes and persists the dispatch status from how much of it has
/// been returned: fully returned -> `Returned`, some returned ->
/// `PartiallyReturned`, nothing returned -> left alone.
///
/// Without this a dispatch stayed "Pending" forever even after every unit
/// came back, which is what the operator sees first on the dispatch list.
async fn sync_dispatch_status<C: ConnectionTrait>(
    db: &C,
    dispatch_id: Uuid,
    dispatch_items: &[dispatch_item::Model],
) -> AppResult<()> {
    let mut total_dispatched = 0.0;
    let mut total_returned = 0.0;

    for item in dispatch_items {
        total_dispatched += item.quantity;
        total_returned += get_returned_qty(db, dispatch_id, item.product_id).await?;
    }

    // Nothing to say about a dispatch with no line items.
    if total_dispatched <= 0.0 {
        return Ok(());
    }

    // Float tolerance: quantities are f64, so an exact `==` comparison
    // would leave a fully-returned dispatch stuck at "partially" after
    // e.g. three 0.1 returns against a 0.3 line.
    const EPSILON: f64 = 1e-9;

    let new_status = if total_returned >= total_dispatched - EPSILON {
        DispatchStatus::Returned
    } else if total_returned > EPSILON {
        DispatchStatus::PartiallyReturned
    } else {
        return Ok(());
    };

    let model = dispatch::Entity::find_by_id(dispatch_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("dispatch {dispatch_id} not found")))?;

    // Cancelled is terminal -- a return against a cancelled dispatch
    // shouldn't quietly resurrect it into an active state.
    if model.status == DispatchStatus::Cancelled.as_str() {
        return Ok(());
    }

    let mut active: dispatch::ActiveModel = model.into();
    active.status = Set(new_status.as_str().to_string());
    active.updated_at = Set(Utc::now().naive_utc());
    active.update(db).await?;

    Ok(())
}

/// Records a product return against a previous dispatch.
///
/// Validates:
/// - The dispatch exists
/// - Each product was in that dispatch
/// - Return quantity does not exceed (dispatched - already returned)
///
/// On success, records inward stock movements (one per item) that restore
/// the stock balance.
pub async fn create_return(
    db: &DatabaseConnection,
    input: CreateReturnInput,
    performed_by: Uuid,
) -> AppResult<ReturnResult> {
    if input.items.is_empty() {
        return Err(AppError::Validation("at least one item is required".into()));
    }

    // Verify dispatch exists
    let dispatch_model = dispatch::Entity::find_by_id(input.dispatch_id)
        .one(db)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("dispatch {} not found", input.dispatch_id))
        })?;

    // Get the dispatch line items
    let dispatch_items = dispatch_item::Entity::find()
        .filter(dispatch_item::Column::DispatchId.eq(input.dispatch_id))
        .all(db)
        .await?;

    let txn = db.begin().await?;

    for return_item in &input.items {
        if return_item.quantity <= 0.0 {
            return Err(AppError::Validation(
                "return quantity must be greater than zero".into(),
            ));
        }

        // Find the dispatch line item for this product
        let dispatch_line = dispatch_items
            .iter()
            .find(|di| di.product_id == return_item.product_id)
            .ok_or_else(|| {
                AppError::Validation(format!(
                    "product {} was not part of dispatch {}",
                    return_item.product_id, input.dispatch_id
                ))
            })?;

        // Check how much has already been returned
        let already_returned = get_returned_qty(&txn, input.dispatch_id, return_item.product_id).await?;
        let max_returnable = dispatch_line.quantity - already_returned;

        if return_item.quantity > max_returnable {
            return Err(AppError::Validation(format!(
                "return quantity ({}) exceeds returnable balance ({:.2}) for this product",
                return_item.quantity, max_returnable
            )));
        }

        // Record a RETURN movement linked to the dispatch. This restores
        // the on-hand balance without touching the inward figure.
        let remarks = match &input.remarks {
            Some(r) if !r.trim().is_empty() => {
                Some(format!("Return from {} | {}", dispatch_model.invoice_number, r))
            }
            _ => Some(format!("Return from {}", dispatch_model.invoice_number)),
        };

        stock_service::record_return_in(
            &txn,
            stock_service::ReturnInput {
                product_id: return_item.product_id,
                quantity: return_item.quantity,
                dispatch_id: input.dispatch_id,
                reference_number: Some(dispatch_model.invoice_number.clone()),
                remarks,
            },
            performed_by,
        )
        .await?;
    }

    // Roll the dispatch status forward now that these returns are in the
    // same transaction -- so the list never shows "Pending" for a dispatch
    // whose goods are all back.
    sync_dispatch_status(&txn, input.dispatch_id, &dispatch_items).await?;

    txn.commit().await?;

    Ok(ReturnResult {
        dispatch_id: input.dispatch_id,
        items_returned: input.items.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::services::{
        auth_service::test_support, customer_service, dispatch_service, product_service,
        report_service, stock_service, unit_service,
    };
    use sea_orm::DatabaseConnection;

    struct Fixture {
        conn: DatabaseConnection,
        dir: std::path::PathBuf,
        product_id: Uuid,
        customer_id: Uuid,
        user: Uuid,
    }

    /// Seeds one product with 20 units of inward stock -- the exact
    /// scenario from the bug report ("i add 20 in inward").
    async fn setup() -> Fixture {
        let dir = std::env::temp_dir().join(format!("erp-return-test-{}", Uuid::new_v4()));
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
                sku: "SPOOL-300MM".into(),
                name: "300MM".into(),
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
                name: "Return Test Customer".into(),
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
                quantity: 20.0,
                reference_number: None,
                remarks: None,
            },
            user,
        )
        .await
        .unwrap();

        Fixture {
            conn,
            dir,
            product_id: product.id,
            customer_id: customer.id,
            user,
        }
    }

    async fn dispatch_ten(fx: &Fixture, invoice: &str) -> Uuid {
        dispatch_service::create(
            &fx.conn,
            dispatch_service::CreateDispatchInput {
                invoice_number: invoice.into(),
                customer_id: fx.customer_id,
                vehicle_number: None,
                driver_name: None,
                driver_phone: None,
                dispatch_date: Utc::now().naive_utc(),
                remarks: None,
                items: vec![dispatch_service::DispatchItemInput {
                    product_id: fx.product_id,
                    quantity: 10.0,
                    weight_kg: None,
                }],
                reel_numbers: vec![],
            },
            fx.user,
        )
        .await
        .unwrap()
        .id
    }

    async fn on_hand(fx: &Fixture) -> f64 {
        stock_service::list_balances(&fx.conn)
            .await
            .unwrap()
            .iter()
            .find(|b| b.product.id == fx.product_id)
            .unwrap()
            .quantity_on_hand
    }

    /// The reported bug: inward 20, dispatch 10, return 3 must leave the
    /// INWARD total at 20 (not 23) while still restoring the balance.
    #[tokio::test]
    async fn return_does_not_inflate_the_inward_total() {
        let fx = setup().await;
        let dispatch_id = dispatch_ten(&fx, "INV-1001").await;

        create_return(
            &fx.conn,
            CreateReturnInput {
                dispatch_id,
                items: vec![ReturnItemInput {
                    product_id: fx.product_id,
                    quantity: 3.0,
                }],
                remarks: None,
            },
            fx.user,
        )
        .await
        .unwrap();

        let summary = report_service::product_wise_summary(
            &fx.conn,
            report_service::DateRange {
                from: None,
                to: None,
            },
        )
        .await
        .unwrap();
        let row = summary
            .iter()
            .find(|r| r.product_id == fx.product_id)
            .unwrap();

        assert_eq!(row.total_inward, 20.0, "inward must stay at what was added");
        assert_eq!(row.total_outward, 10.0);
        assert_eq!(row.total_return, 3.0, "return gets its own column");

        // Balance: 20 in, 10 out, 3 back = 13.
        assert_eq!(on_hand(&fx).await, 13.0);

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    /// Multiple partial returns are allowed and accumulate, but the total
    /// can never exceed what was dispatched.
    #[tokio::test]
    async fn partial_returns_accumulate_and_cap_at_dispatched_qty() {
        let fx = setup().await;
        let dispatch_id = dispatch_ten(&fx, "INV-1002").await;

        for qty in [4.0, 6.0] {
            create_return(
                &fx.conn,
                CreateReturnInput {
                    dispatch_id,
                    items: vec![ReturnItemInput {
                        product_id: fx.product_id,
                        quantity: qty,
                    }],
                    remarks: None,
                },
                fx.user,
            )
            .await
            .unwrap();
        }

        // All 10 are back, so on-hand is the original 20 again -- never more.
        assert_eq!(on_hand(&fx).await, 20.0);

        // An 11th unit was never dispatched, so it can't come back.
        let overshoot = create_return(
            &fx.conn,
            CreateReturnInput {
                dispatch_id,
                items: vec![ReturnItemInput {
                    product_id: fx.product_id,
                    quantity: 1.0,
                }],
                remarks: None,
            },
            fx.user,
        )
        .await;
        assert!(matches!(overshoot, Err(AppError::Validation(_))));
        assert_eq!(on_hand(&fx).await, 20.0, "rejected return must not apply");

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    /// A dispatch must not stay "pending" once its goods have come back.
    #[tokio::test]
    async fn dispatch_status_tracks_return_progress() {
        let fx = setup().await;
        let dispatch_id = dispatch_ten(&fx, "INV-1003").await;

        let status = |id: Uuid| {
            let conn = fx.conn.clone();
            async move {
                dispatch::Entity::find_by_id(id)
                    .one(&conn)
                    .await
                    .unwrap()
                    .unwrap()
                    .status
            }
        };

        assert_eq!(status(dispatch_id).await, DispatchStatus::Pending.as_str());

        create_return(
            &fx.conn,
            CreateReturnInput {
                dispatch_id,
                items: vec![ReturnItemInput {
                    product_id: fx.product_id,
                    quantity: 4.0,
                }],
                remarks: None,
            },
            fx.user,
        )
        .await
        .unwrap();
        assert_eq!(
            status(dispatch_id).await,
            DispatchStatus::PartiallyReturned.as_str()
        );

        create_return(
            &fx.conn,
            CreateReturnInput {
                dispatch_id,
                items: vec![ReturnItemInput {
                    product_id: fx.product_id,
                    quantity: 6.0,
                }],
                remarks: None,
            },
            fx.user,
        )
        .await
        .unwrap();
        assert_eq!(
            status(dispatch_id).await,
            DispatchStatus::Returned.as_str(),
            "fully returned dispatch must not read as pending"
        );

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    /// Returnable balances drive the UI's max-quantity inputs, so they must
    /// reflect prior returns.
    #[tokio::test]
    async fn returnable_items_reflect_prior_returns() {
        let fx = setup().await;
        let dispatch_id = dispatch_ten(&fx, "INV-1004").await;

        let before = get_returnable_items(&fx.conn, dispatch_id).await.unwrap();
        assert_eq!(before.len(), 1);
        assert_eq!(before[0].dispatched_qty, 10.0);
        assert_eq!(before[0].already_returned_qty, 0.0);
        assert_eq!(before[0].returnable_qty, 10.0);

        create_return(
            &fx.conn,
            CreateReturnInput {
                dispatch_id,
                items: vec![ReturnItemInput {
                    product_id: fx.product_id,
                    quantity: 7.5,
                }],
                remarks: None,
            },
            fx.user,
        )
        .await
        .unwrap();

        let after = get_returnable_items(&fx.conn, dispatch_id).await.unwrap();
        assert_eq!(after[0].already_returned_qty, 7.5);
        assert_eq!(after[0].returnable_qty, 2.5);

        let _ = std::fs::remove_dir_all(&fx.dir);
    }

    /// A product that was never on the dispatch can't be returned against it.
    #[tokio::test]
    async fn rejects_product_not_in_dispatch() {
        let fx = setup().await;
        let dispatch_id = dispatch_ten(&fx, "INV-1005").await;

        let result = create_return(
            &fx.conn,
            CreateReturnInput {
                dispatch_id,
                items: vec![ReturnItemInput {
                    product_id: Uuid::new_v4(),
                    quantity: 1.0,
                }],
                remarks: None,
            },
            fx.user,
        )
        .await;

        assert!(matches!(result, Err(AppError::Validation(_))));

        let _ = std::fs::remove_dir_all(&fx.dir);
    }
}
