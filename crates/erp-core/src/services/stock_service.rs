use crate::domain::StockMovementType;
use crate::entities::{product, stock_balance, stock_movement};
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, Set, TransactionTrait,
};
use uuid::Uuid;

pub struct InwardInput {
    pub product_id: Uuid,
    pub quantity: f64,
    pub reference_number: Option<String>,
    pub remarks: Option<String>,
}

pub struct OutwardInput {
    pub product_id: Uuid,
    pub quantity: f64,
    pub reference_number: Option<String>,
    pub remarks: Option<String>,
    /// Set when this outward movement is a side effect of creating a
    /// dispatch, so the movement and the dispatch stay linked for
    /// "dispatch reports" and per-product history views.
    pub dispatch_id: Option<Uuid>,
}

pub struct AdjustmentInput {
    pub product_id: Uuid,
    /// Signed delta: positive corrects stock upward, negative corrects it
    /// downward. Distinct from inward/outward's always-positive `quantity`
    /// because an adjustment's whole purpose is expressing "the recorded
    /// balance was wrong by this much", not a physical movement direction.
    pub delta: f64,
    pub remarks: String,
}

/// Fetches the current balance row for a product, treating a missing row
/// as a bug rather than "zero stock" -- every product gets a
/// `stock_balances` row at creation time (see `product_service::create`),
/// so a missing row means something upstream didn't do that.
async fn get_balance_for_update<C: ConnectionTrait>(
    db: &C,
    product_id: Uuid,
) -> AppResult<stock_balance::Model> {
    stock_balance::Entity::find_by_id(product_id)
        .one(db)
        .await?
        .ok_or_else(|| {
            AppError::Internal(anyhow::anyhow!(
                "product {product_id} has no stock_balances row -- this should never happen"
            ))
        })
}

async fn apply_balance_delta<C: ConnectionTrait>(
    db: &C,
    product_id: Uuid,
    delta: f64,
) -> AppResult<f64> {
    let balance = get_balance_for_update(db, product_id).await?;
    let new_quantity = balance.quantity_on_hand + delta;

    let mut active: stock_balance::ActiveModel = balance.into();
    active.quantity_on_hand = Set(new_quantity);
    active.updated_at = Set(Utc::now().naive_utc());
    active.update(db).await?;

    Ok(new_quantity)
}

/// Bundles the fields that vary between inward/outward/adjustment ledger
/// entries so `record_movement` doesn't take nine positional arguments.
struct NewMovement {
    product_id: Uuid,
    movement_type: StockMovementType,
    quantity: f64,
    adjustment_delta: Option<f64>,
    dispatch_id: Option<Uuid>,
    reference_number: Option<String>,
    remarks: Option<String>,
    performed_by: Uuid,
}

/// Inserts the ledger row and applies its effect to `stock_balances` in one
/// go. Generic over `ConnectionTrait` so `dispatch_service` can call this
/// with a transaction handle and have the outward movement commit
/// atomically alongside the dispatch it belongs to.
async fn record_movement<C: ConnectionTrait>(
    db: &C,
    new_movement: NewMovement,
) -> AppResult<stock_movement::Model> {
    let movement = stock_movement::ActiveModel {
        id: Set(Uuid::new_v4()),
        product_id: Set(new_movement.product_id),
        movement_type: Set(new_movement.movement_type.as_str().to_string()),
        quantity: Set(new_movement.quantity),
        adjustment_delta: Set(new_movement.adjustment_delta),
        dispatch_id: Set(new_movement.dispatch_id),
        reference_number: Set(new_movement.reference_number),
        remarks: Set(new_movement.remarks),
        performed_by: Set(new_movement.performed_by),
        created_at: Set(Utc::now().naive_utc()),
    };
    Ok(movement.insert(db).await?)
}

async fn ensure_product_active<C: ConnectionTrait>(db: &C, product_id: Uuid) -> AppResult<()> {
    let product = product::Entity::find_by_id(product_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("product {product_id} not found")))?;
    if !product.is_active {
        return Err(AppError::Validation(
            "cannot record stock movements against an inactive product".into(),
        ));
    }
    Ok(())
}

pub async fn record_inward(
    db: &DatabaseConnection,
    input: InwardInput,
    performed_by: Uuid,
) -> AppResult<stock_movement::Model> {
    if input.quantity <= 0.0 {
        return Err(AppError::Validation(
            "inward quantity must be greater than zero".into(),
        ));
    }
    ensure_product_active(db, input.product_id).await?;

    let txn = db.begin().await?;
    let movement = record_movement(
        &txn,
        NewMovement {
            product_id: input.product_id,
            movement_type: StockMovementType::Inward,
            quantity: input.quantity,
            adjustment_delta: None,
            dispatch_id: None,
            reference_number: input.reference_number,
            remarks: input.remarks,
            performed_by,
        },
    )
    .await?;
    apply_balance_delta(&txn, input.product_id, input.quantity).await?;
    txn.commit().await?;

    Ok(movement)
}

/// Records an outward movement. When called directly from the Inventory
/// module (`dispatch_id: None`), the caller is responsible for opening its
/// own transaction if it needs one; when called from `dispatch_service`
/// with an existing transaction connection, use `record_outward_in` below
/// instead so it participates in the caller's transaction rather than
/// starting a new one.
pub async fn record_outward(
    db: &DatabaseConnection,
    input: OutwardInput,
    performed_by: Uuid,
) -> AppResult<stock_movement::Model> {
    if input.quantity <= 0.0 {
        return Err(AppError::Validation(
            "outward quantity must be greater than zero".into(),
        ));
    }
    ensure_product_active(db, input.product_id).await?;

    let txn = db.begin().await?;
    let movement = record_outward_in(&txn, input, performed_by).await?;
    txn.commit().await?;

    Ok(movement)
}

/// Same as `record_outward` but takes any `ConnectionTrait` (including a
/// `DatabaseTransaction`) so `dispatch_service` can compose it into a
/// larger all-or-nothing dispatch creation.
pub async fn record_outward_in<C: ConnectionTrait>(
    db: &C,
    input: OutwardInput,
    performed_by: Uuid,
) -> AppResult<stock_movement::Model> {
    let balance = get_balance_for_update(db, input.product_id).await?;
    if balance.quantity_on_hand < input.quantity {
        return Err(AppError::Validation(format!(
            "insufficient stock: {} on hand, {} requested",
            balance.quantity_on_hand, input.quantity
        )));
    }

    let movement = record_movement(
        db,
        NewMovement {
            product_id: input.product_id,
            movement_type: StockMovementType::Outward,
            quantity: input.quantity,
            adjustment_delta: None,
            dispatch_id: input.dispatch_id,
            reference_number: input.reference_number,
            remarks: input.remarks,
            performed_by,
        },
    )
    .await?;
    apply_balance_delta(db, input.product_id, -input.quantity).await?;

    Ok(movement)
}

/// Records a manual stock adjustment and a matching audit log entry in one
/// transaction -- the audit trail here isn't optional bookkeeping, it's
/// the whole point of the feature ("Manual stock adjustments (with audit
/// trail)"), so it must never be possible for one to succeed without the
/// other.
pub async fn record_adjustment(
    db: &DatabaseConnection,
    input: AdjustmentInput,
    performed_by: Uuid,
) -> AppResult<stock_movement::Model> {
    if input.delta == 0.0 {
        return Err(AppError::Validation(
            "adjustment delta cannot be zero".into(),
        ));
    }
    if input.remarks.trim().is_empty() {
        return Err(AppError::Validation(
            "a reason is required for manual stock adjustments".into(),
        ));
    }
    ensure_product_active(db, input.product_id).await?;

    let balance_before = get_balance_for_update(db, input.product_id).await?;
    if balance_before.quantity_on_hand + input.delta < 0.0 {
        return Err(AppError::Validation(format!(
            "adjustment would result in negative stock: {} on hand, {} adjustment",
            balance_before.quantity_on_hand, input.delta
        )));
    }

    let txn = db.begin().await?;

    let movement = record_movement(
        &txn,
        NewMovement {
            product_id: input.product_id,
            movement_type: StockMovementType::Adjustment,
            quantity: input.delta.abs(),
            adjustment_delta: Some(input.delta),
            dispatch_id: None,
            reference_number: None,
            remarks: Some(input.remarks.clone()),
            performed_by,
        },
    )
    .await?;
    let new_quantity = apply_balance_delta(&txn, input.product_id, input.delta).await?;

    super::audit_service::log_action(
        &txn,
        "stock_adjustment",
        &movement.id.to_string(),
        "adjust",
        performed_by,
        Some(serde_json::json!({ "quantity_on_hand": balance_before.quantity_on_hand })),
        Some(serde_json::json!({ "quantity_on_hand": new_quantity, "delta": input.delta })),
        Some(input.remarks),
    )
    .await?;

    txn.commit().await?;

    Ok(movement)
}

pub struct StockBalanceView {
    pub product: product::Model,
    pub unit_symbol: String,
    pub quantity_on_hand: f64,
    pub is_low_stock: bool,
    pub updated_at: chrono::NaiveDateTime,
}

/// Product-wise inventory view: every active product joined with its
/// current balance and unit, flagging anything at/under its reorder
/// level. This is the primary read the Dashboard and Inventory Overview
/// pages hang off of.
pub async fn list_balances(db: &DatabaseConnection) -> AppResult<Vec<StockBalanceView>> {
    use crate::entities::unit;

    let rows = product::Entity::find()
        .filter(product::Column::IsActive.eq(true))
        .find_also_related(stock_balance::Entity)
        .order_by_asc(product::Column::Name)
        .all(db)
        .await?;

    let mut views = Vec::with_capacity(rows.len());
    for (product, balance) in rows {
        let unit_model = unit::Entity::find_by_id(product.base_unit_id)
            .one(db)
            .await?;
        let quantity_on_hand = balance.map(|b| b.quantity_on_hand).unwrap_or(0.0);
        let updated_at = product.updated_at;
        views.push(StockBalanceView {
            is_low_stock: quantity_on_hand <= product.reorder_level,
            unit_symbol: unit_model.map(|u| u.symbol).unwrap_or_default(),
            quantity_on_hand,
            updated_at,
            product,
        });
    }

    Ok(views)
}

pub struct MovementFilter {
    pub product_id: Option<Uuid>,
    pub movement_type: Option<StockMovementType>,
    pub from: Option<chrono::NaiveDateTime>,
    pub to: Option<chrono::NaiveDateTime>,
}

/// Full stock history log, newest first, paginated. Backs both the
/// dedicated "Stock History" page and per-product movement history.
pub async fn list_movements(
    db: &DatabaseConnection,
    filter: MovementFilter,
    page: u64,
    page_size: u64,
) -> AppResult<(Vec<stock_movement::Model>, u64)> {
    let mut query = stock_movement::Entity::find();

    if let Some(product_id) = filter.product_id {
        query = query.filter(stock_movement::Column::ProductId.eq(product_id));
    }
    if let Some(movement_type) = filter.movement_type {
        query = query.filter(stock_movement::Column::MovementType.eq(movement_type.as_str()));
    }
    if let Some(from) = filter.from {
        query = query.filter(stock_movement::Column::CreatedAt.gte(from));
    }
    if let Some(to) = filter.to {
        query = query.filter(stock_movement::Column::CreatedAt.lte(to));
    }

    let paginator = query
        .order_by_desc(stock_movement::Column::CreatedAt)
        .paginate(db, page_size.max(1));

    let total = paginator.num_items().await?;
    let rows = paginator.fetch_page(page).await?;

    Ok((rows, total))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::services::{product_service, unit_service};

    async fn setup() -> (DatabaseConnection, std::path::PathBuf, Uuid, Uuid) {
        let dir = std::env::temp_dir().join(format!("erp-stock-test-{}", Uuid::new_v4()));
        let conn = db::init(&dir.join("test.db")).await.unwrap();
        let (_, performed_by) = crate::services::auth_service::test_support::seed_test_user(&conn).await;

        let unit = unit_service::create(
            &conn,
            unit_service::CreateUnitInput {
                name: "Kilogram".into(),
                symbol: "kg".into(),
                conversion_factor: 1.0,
            },
        )
        .await
        .unwrap();

        let product = product_service::create(
            &conn,
            product_service::CreateProductInput {
                sku: "SKU-1".into(),
                name: "Test Product".into(),
                description: None,
                base_unit_id: unit.id,
                specifications: None,
                reorder_level: 10.0,
            },
        )
        .await
        .unwrap();

        (conn, dir, product.id, performed_by)
    }

    #[tokio::test]
    async fn inward_then_outward_updates_balance_correctly() {
        let (conn, dir, product_id, user) = setup().await;

        record_inward(
            &conn,
            InwardInput {
                product_id,
                quantity: 100.0,
                reference_number: None,
                remarks: None,
            },
            user,
        )
        .await
        .unwrap();

        record_outward(
            &conn,
            OutwardInput {
                product_id,
                quantity: 30.0,
                reference_number: None,
                remarks: None,
                dispatch_id: None,
            },
            user,
        )
        .await
        .unwrap();

        let balances = list_balances(&conn).await.unwrap();
        let balance = balances.iter().find(|b| b.product.id == product_id).unwrap();
        assert_eq!(balance.quantity_on_hand, 70.0);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn outward_rejects_when_insufficient_stock() {
        let (conn, dir, product_id, user) = setup().await;

        let result = record_outward(
            &conn,
            OutwardInput {
                product_id,
                quantity: 5.0,
                reference_number: None,
                remarks: None,
                dispatch_id: None,
            },
            user,
        )
        .await;

        assert!(matches!(result, Err(AppError::Validation(_))));

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn adjustment_requires_remarks_and_updates_balance() {
        let (conn, dir, product_id, user) = setup().await;

        record_inward(
            &conn,
            InwardInput {
                product_id,
                quantity: 50.0,
                reference_number: None,
                remarks: None,
            },
            user,
        )
        .await
        .unwrap();

        let missing_remarks = record_adjustment(
            &conn,
            AdjustmentInput {
                product_id,
                delta: -5.0,
                remarks: "".into(),
            },
            user,
        )
        .await;
        assert!(matches!(missing_remarks, Err(AppError::Validation(_))));

        record_adjustment(
            &conn,
            AdjustmentInput {
                product_id,
                delta: -5.0,
                remarks: "physical count correction".into(),
            },
            user,
        )
        .await
        .unwrap();

        let balances = list_balances(&conn).await.unwrap();
        let balance = balances.iter().find(|b| b.product.id == product_id).unwrap();
        assert_eq!(balance.quantity_on_hand, 45.0);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
