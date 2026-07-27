use crate::domain::{ReelEventType, ReelStatus};
use crate::entities::{customer, product, reel, reel_movement};
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set, TransactionTrait,
};
use std::str::FromStr;
use uuid::Uuid;

pub struct RegisterReelInput {
    pub reel_number: String,
    pub product_id: Uuid,
    pub weight_kg: Option<f64>,
}

/// Registers a new physical reel in the system, status `in_stock`. This is
/// distinct from "dispatching" a reel -- a reel exists (and can appear in
/// stock counts) before it's ever sent anywhere.
pub async fn register(
    db: &DatabaseConnection,
    input: RegisterReelInput,
    performed_by: Uuid,
) -> AppResult<reel::Model> {
    if input.reel_number.trim().is_empty() {
        return Err(AppError::Validation("reel number is required".into()));
    }

    let exists = reel::Entity::find()
        .filter(reel::Column::ReelNumber.eq(input.reel_number.clone()))
        .one(db)
        .await?
        .is_some();
    if exists {
        return Err(AppError::Conflict(format!(
            "a reel numbered '{}' already exists",
            input.reel_number
        )));
    }

    let product_exists = product::Entity::find_by_id(input.product_id)
        .one(db)
        .await?
        .is_some();
    if !product_exists {
        return Err(AppError::Validation(format!(
            "product {} does not exist",
            input.product_id
        )));
    }

    let now = Utc::now().naive_utc();
    let id = Uuid::new_v4();

    let txn = db.begin().await?;

    let model = reel::ActiveModel {
        id: Set(id),
        reel_number: Set(input.reel_number),
        product_id: Set(input.product_id),
        status: Set(ReelStatus::InStock.as_str().to_string()),
        current_customer_id: Set(None),
        weight_kg: Set(input.weight_kg),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let created = model.insert(&txn).await?;

    record_movement_in(
        &txn,
        id,
        ReelEventType::Created,
        None,
        None,
        None,
        performed_by,
    )
    .await?;

    txn.commit().await?;
    Ok(created)
}

async fn record_movement_in<C: ConnectionTrait>(
    db: &C,
    reel_id: Uuid,
    event_type: ReelEventType,
    dispatch_id: Option<Uuid>,
    customer_id: Option<Uuid>,
    remarks: Option<String>,
    performed_by: Uuid,
) -> AppResult<reel_movement::Model> {
    let entry = reel_movement::ActiveModel {
        id: Set(Uuid::new_v4()),
        reel_id: Set(reel_id),
        event_type: Set(event_type.as_str().to_string()),
        dispatch_id: Set(dispatch_id),
        customer_id: Set(customer_id),
        remarks: Set(remarks),
        performed_by: Set(performed_by),
        created_at: Set(Utc::now().naive_utc()),
    };
    Ok(entry.insert(db).await?)
}

async fn get_for_update<C: ConnectionTrait>(db: &C, reel_id: Uuid) -> AppResult<reel::Model> {
    reel::Entity::find_by_id(reel_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("reel {reel_id} not found")))
}

fn parse_status(raw: &str) -> AppResult<ReelStatus> {
    ReelStatus::from_str(raw).map_err(|_| AppError::Internal(anyhow::anyhow!("invalid reel status in database: {raw}")))
}

/// Marks a reel as dispatched to `customer_id`, updating the denormalized
/// `current_customer_id` pointer and appending a movement record. Exposed
/// as `..._in` so `dispatch_service` can call this inside the same
/// transaction as the dispatch + stock outward it's creating -- a
/// dispatch either fully succeeds (stock, reel, and dispatch rows all
/// commit) or fully fails.
pub async fn dispatch_reel_in<C: ConnectionTrait>(
    db: &C,
    reel_id: Uuid,
    customer_id: Uuid,
    dispatch_id: Uuid,
    performed_by: Uuid,
) -> AppResult<reel::Model> {
    let existing = get_for_update(db, reel_id).await?;
    let status = parse_status(&existing.status)?;

    if status != ReelStatus::InStock {
        return Err(AppError::Validation(format!(
            "reel {} is not available to dispatch (current status: {})",
            existing.reel_number, existing.status
        )));
    }

    let customer_exists = customer::Entity::find_by_id(customer_id)
        .one(db)
        .await?
        .is_some();
    if !customer_exists {
        return Err(AppError::Validation(format!(
            "customer {customer_id} does not exist"
        )));
    }

    let mut active: reel::ActiveModel = existing.into();
    active.status = Set(ReelStatus::Dispatched.as_str().to_string());
    active.current_customer_id = Set(Some(customer_id));
    active.updated_at = Set(Utc::now().naive_utc());
    let updated = active.update(db).await?;

    record_movement_in(
        db,
        reel_id,
        ReelEventType::Dispatched,
        Some(dispatch_id),
        Some(customer_id),
        None,
        performed_by,
    )
    .await?;

    Ok(updated)
}

pub struct ReturnReelInput {
    pub reel_id: Uuid,
    pub remarks: Option<String>,
}

/// Marks a dispatched reel as returned by its current customer, clearing
/// the denormalized holder pointer. A returned reel is NOT automatically
/// put back `in_stock` for redispatch -- that's a deliberate separate step
/// (not yet exposed) so a returned reel can be inspected before being
/// trusted for reuse, matching "Returned reels list" as its own status
/// rather than silently merging back into available stock.
pub async fn return_reel(
    db: &DatabaseConnection,
    input: ReturnReelInput,
    performed_by: Uuid,
) -> AppResult<reel::Model> {
    let existing = get_for_update(db, input.reel_id).await?;
    let status = parse_status(&existing.status)?;

    if status != ReelStatus::Dispatched {
        return Err(AppError::Validation(format!(
            "reel {} cannot be returned from status {}",
            existing.reel_number, existing.status
        )));
    }
    let customer_id = existing.current_customer_id;

    let txn = db.begin().await?;

    let mut active: reel::ActiveModel = existing.into();
    active.status = Set(ReelStatus::Returned.as_str().to_string());
    active.current_customer_id = Set(None);
    active.updated_at = Set(Utc::now().naive_utc());
    let updated = active.update(&txn).await?;

    record_movement_in(
        &txn,
        input.reel_id,
        ReelEventType::Returned,
        None,
        customer_id,
        input.remarks,
        performed_by,
    )
    .await?;

    txn.commit().await?;
    Ok(updated)
}

pub struct MarkLostOrDamagedInput {
    pub reel_id: Uuid,
    pub damaged: bool,
    pub remarks: String,
}

/// Marks a reel lost or damaged from any non-terminal status. Unlike
/// `return_reel`, this is intentionally allowed from `in_stock` too (a
/// reel can be found damaged in the warehouse, not just after dispatch).
pub async fn mark_lost_or_damaged(
    db: &DatabaseConnection,
    input: MarkLostOrDamagedInput,
    performed_by: Uuid,
) -> AppResult<reel::Model> {
    if input.remarks.trim().is_empty() {
        return Err(AppError::Validation(
            "a reason is required when marking a reel lost or damaged".into(),
        ));
    }

    let existing = get_for_update(db, input.reel_id).await?;
    let status = parse_status(&existing.status)?;
    if matches!(status, ReelStatus::Lost | ReelStatus::Damaged) {
        return Err(AppError::Validation(format!(
            "reel {} is already marked {}",
            existing.reel_number, existing.status
        )));
    }
    let customer_id = existing.current_customer_id;

    let new_status = if input.damaged {
        ReelStatus::Damaged
    } else {
        ReelStatus::Lost
    };
    let event_type = if input.damaged {
        ReelEventType::Damaged
    } else {
        ReelEventType::Lost
    };

    let txn = db.begin().await?;

    let mut active: reel::ActiveModel = existing.into();
    active.status = Set(new_status.as_str().to_string());
    active.updated_at = Set(Utc::now().naive_utc());
    let updated = active.update(&txn).await?;

    record_movement_in(
        &txn,
        input.reel_id,
        event_type,
        None,
        customer_id,
        Some(input.remarks),
        performed_by,
    )
    .await?;

    txn.commit().await?;
    Ok(updated)
}

pub struct ReelFilter {
    pub status: Option<ReelStatus>,
    pub customer_id: Option<Uuid>,
    pub product_id: Option<Uuid>,
}

pub async fn list(
    db: &DatabaseConnection,
    filter: ReelFilter,
    page: u64,
    page_size: u64,
) -> AppResult<(Vec<reel::Model>, u64)> {
    let mut query = reel::Entity::find();

    if let Some(status) = filter.status {
        query = query.filter(reel::Column::Status.eq(status.as_str()));
    }
    if let Some(customer_id) = filter.customer_id {
        query = query.filter(reel::Column::CurrentCustomerId.eq(customer_id));
    }
    if let Some(product_id) = filter.product_id {
        query = query.filter(reel::Column::ProductId.eq(product_id));
    }

    let paginator = query
        .order_by_desc(reel::Column::UpdatedAt)
        .paginate(db, page_size.max(1));

    let total = paginator.num_items().await?;
    let rows = paginator.fetch_page(page).await?;

    Ok((rows, total))
}

pub async fn get_by_reel_number(db: &DatabaseConnection, reel_number: &str) -> AppResult<reel::Model> {
    reel::Entity::find()
        .filter(reel::Column::ReelNumber.eq(reel_number))
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("reel '{reel_number}' not found")))
}

/// Full movement history for one reel (created/dispatched/returned/lost/
/// damaged events, newest first) -- the "Dispatch history per reel" +
/// "Return tracking" requirement.
pub async fn history_for_reel(
    db: &DatabaseConnection,
    reel_id: Uuid,
) -> AppResult<Vec<reel_movement::Model>> {
    Ok(reel_movement::Entity::find()
        .filter(reel_movement::Column::ReelId.eq(reel_id))
        .order_by_desc(reel_movement::Column::CreatedAt)
        .all(db)
        .await?)
}

/// A customer's reel-history row enriched with the reel number and product
/// name -- a bare `reel_id` UUID means nothing to a stock clerk reading
/// this list, they think in terms of "reel #4521 (Kraft Paper 80GSM)".
pub struct CustomerReelMovement {
    pub movement: reel_movement::Model,
    pub reel_number: String,
    pub product_name: String,
}

/// Every reel event involving a given customer (their reels currently out,
/// returned, lost, damaged), newest first -- "Customer-wise reel history".
pub async fn history_for_customer(
    db: &DatabaseConnection,
    customer_id: Uuid,
) -> AppResult<Vec<CustomerReelMovement>> {
    let rows = reel_movement::Entity::find()
        .filter(reel_movement::Column::CustomerId.eq(customer_id))
        .find_also_related(reel::Entity)
        .order_by_desc(reel_movement::Column::CreatedAt)
        .all(db)
        .await?;

    let mut out = Vec::with_capacity(rows.len());
    for (movement, reel) in rows {
        // `reel` should always be `Some` (reel_movements.reel_id is a
        // non-nullable FK) -- skip defensively rather than panic if the
        // data is ever inconsistent.
        let Some(reel) = reel else { continue };
        let product_name = product::Entity::find_by_id(reel.product_id)
            .one(db)
            .await?
            .map(|p| p.name)
            .unwrap_or_else(|| "Unknown product".to_string());

        out.push(CustomerReelMovement {
            movement,
            reel_number: reel.reel_number,
            product_name,
        });
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::services::{customer_service, product_service, unit_service};

    async fn setup() -> (DatabaseConnection, std::path::PathBuf, Uuid, Uuid, Uuid) {
        let dir = std::env::temp_dir().join(format!("erp-reel-test-{}", Uuid::new_v4()));
        let conn = db::init(&dir.join("test.db")).await.unwrap();
        let (_, performed_by) = crate::services::auth_service::test_support::seed_test_user(&conn).await;

        let unit = unit_service::create(
            &conn,
            unit_service::CreateUnitInput {
                name: "Meter".into(),
                symbol: "m".into(),
                conversion_factor: 1.0,
            },
        )
        .await
        .unwrap();

        let product = product_service::create(
            &conn,
            product_service::CreateProductInput {
                sku: "REEL-SKU".into(),
                name: "Cable Reel".into(),
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
                name: "Acme Corp".into(),
                contact_person: None,
                phone: None,
                email: None,
                address: None,
                gst_number: None,
            },
        )
        .await
        .unwrap();

        (conn, dir, product.id, customer.id, performed_by)
    }

    /// Minimal direct insert of a `dispatches` row for tests that need a
    /// real dispatch to satisfy `reel_movements.dispatch_id`'s FK, without
    /// pulling in `dispatch_service` (which itself depends on
    /// `reel_service`, so calling it from here would be circular).
    async fn insert_test_dispatch(db: &DatabaseConnection, customer_id: Uuid, created_by: Uuid) -> Uuid {
        use crate::entities::dispatch;
        let id = Uuid::new_v4();
        let now = Utc::now().naive_utc();
        dispatch::ActiveModel {
            id: Set(id),
            invoice_number: Set(format!("TEST-INV-{id}")),
            customer_id: Set(customer_id),
            vehicle_number: Set(None),
            driver_name: Set(None),
            driver_phone: Set(None),
            dispatch_date: Set(now),
            status: Set("pending".to_string()),
            total_weight_kg: Set(None),
            remarks: Set(None),
            created_by: Set(created_by),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(db)
        .await
        .unwrap();
        id
    }

    #[tokio::test]
    async fn full_lifecycle_register_dispatch_return() {
        let (conn, dir, product_id, customer_id, user) = setup().await;

        let reel = register(
            &conn,
            RegisterReelInput {
                reel_number: "R-001".into(),
                product_id,
                weight_kg: Some(25.0),
            },
            user,
        )
        .await
        .unwrap();
        assert_eq!(reel.status, "in_stock");

        // `dispatch_reel_in` is only ever called (in production) from
        // `dispatch_service::create` after a real `dispatches` row already
        // exists in the same transaction -- `reel_movements.dispatch_id`
        // has an FK to it. Insert a minimal row directly here rather than
        // depending on `dispatch_service` from this test module.
        let dispatch_id = insert_test_dispatch(&conn, customer_id, user).await;
        let dispatched = dispatch_reel_in(&conn, reel.id, customer_id, dispatch_id, user)
            .await
            .unwrap();
        assert_eq!(dispatched.status, "dispatched");
        assert_eq!(dispatched.current_customer_id, Some(customer_id));

        // Can't dispatch an already-dispatched reel.
        let other_dispatch_id = insert_test_dispatch(&conn, customer_id, user).await;
        let redispatch = dispatch_reel_in(&conn, reel.id, customer_id, other_dispatch_id, user).await;
        assert!(matches!(redispatch, Err(AppError::Validation(_))));

        let returned = return_reel(
            &conn,
            ReturnReelInput {
                reel_id: reel.id,
                remarks: Some("empty reel returned".into()),
            },
            user,
        )
        .await
        .unwrap();
        assert_eq!(returned.status, "returned");
        assert_eq!(returned.current_customer_id, None);

        let history = history_for_reel(&conn, reel.id).await.unwrap();
        assert_eq!(history.len(), 3); // created, dispatched, returned

        let customer_history = history_for_customer(&conn, customer_id).await.unwrap();
        assert_eq!(customer_history.len(), 2); // dispatched, returned

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn mark_damaged_requires_remarks_and_blocks_double_marking() {
        let (conn, dir, product_id, _customer_id, user) = setup().await;

        let reel = register(
            &conn,
            RegisterReelInput {
                reel_number: "R-002".into(),
                product_id,
                weight_kg: None,
            },
            user,
        )
        .await
        .unwrap();

        let missing_remarks = mark_lost_or_damaged(
            &conn,
            MarkLostOrDamagedInput {
                reel_id: reel.id,
                damaged: true,
                remarks: "".into(),
            },
            user,
        )
        .await;
        assert!(matches!(missing_remarks, Err(AppError::Validation(_))));

        let damaged = mark_lost_or_damaged(
            &conn,
            MarkLostOrDamagedInput {
                reel_id: reel.id,
                damaged: true,
                remarks: "crushed in transit".into(),
            },
            user,
        )
        .await
        .unwrap();
        assert_eq!(damaged.status, "damaged");

        let double_mark = mark_lost_or_damaged(
            &conn,
            MarkLostOrDamagedInput {
                reel_id: reel.id,
                damaged: true,
                remarks: "again".into(),
            },
            user,
        )
        .await;
        assert!(matches!(double_mark, Err(AppError::Validation(_))));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
