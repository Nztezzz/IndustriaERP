use crate::entities::{product, stock_balance, unit};
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use serde_json::Value as Json;
use uuid::Uuid;

pub struct CreateProductInput {
    pub sku: String,
    pub name: String,
    pub description: Option<String>,
    pub base_unit_id: Uuid,
    pub specifications: Option<Json>,
    pub reorder_level: f64,
}

pub struct UpdateProductInput {
    pub sku: String,
    pub name: String,
    pub description: Option<String>,
    pub base_unit_id: Uuid,
    pub specifications: Option<Json>,
    pub reorder_level: f64,
    pub is_active: bool,
}

/// A product row joined with its unit symbol -- the shape almost every
/// list/detail view actually wants, so callers don't each have to do their
/// own join for something this common.
pub struct ProductWithUnit {
    pub product: product::Model,
    pub unit_symbol: String,
}

pub async fn list(db: &DatabaseConnection, include_inactive: bool) -> AppResult<Vec<ProductWithUnit>> {
    let mut query = product::Entity::find().find_also_related(unit::Entity);
    if !include_inactive {
        query = query.filter(product::Column::IsActive.eq(true));
    }

    let rows = query
        .order_by_asc(product::Column::Name)
        .all(db)
        .await?;

    Ok(rows
        .into_iter()
        .filter_map(|(product, unit)| {
            unit.map(|u| ProductWithUnit {
                product,
                unit_symbol: u.symbol,
            })
        })
        .collect())
}

pub async fn get(db: &DatabaseConnection, id: Uuid) -> AppResult<product::Model> {
    product::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("product {id} not found")))
}

async fn ensure_unit_exists(db: &DatabaseConnection, unit_id: Uuid) -> AppResult<()> {
    let exists = unit::Entity::find_by_id(unit_id).one(db).await?.is_some();
    if !exists {
        return Err(AppError::Validation(format!(
            "unit {unit_id} does not exist"
        )));
    }
    Ok(())
}

async fn ensure_sku_unique(
    db: &DatabaseConnection,
    sku: &str,
    exclude_id: Option<Uuid>,
) -> AppResult<()> {
    let mut query = product::Entity::find().filter(product::Column::Sku.eq(sku));
    if let Some(id) = exclude_id {
        query = query.filter(product::Column::Id.ne(id));
    }
    if query.one(db).await?.is_some() {
        return Err(AppError::Conflict(format!(
            "a product with SKU '{sku}' already exists"
        )));
    }
    Ok(())
}

pub async fn create(
    db: &DatabaseConnection,
    input: CreateProductInput,
) -> AppResult<product::Model> {
    if input.sku.trim().is_empty() {
        return Err(AppError::Validation("SKU is required".into()));
    }
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("product name is required".into()));
    }
    if input.reorder_level < 0.0 {
        return Err(AppError::Validation(
            "reorder level cannot be negative".into(),
        ));
    }

    ensure_unit_exists(db, input.base_unit_id).await?;
    ensure_sku_unique(db, &input.sku, None).await?;

    let now = Utc::now().naive_utc();
    let id = Uuid::new_v4();

    let model = product::ActiveModel {
        id: Set(id),
        sku: Set(input.sku),
        name: Set(input.name),
        description: Set(input.description),
        base_unit_id: Set(input.base_unit_id),
        specifications: Set(input.specifications),
        reorder_level: Set(input.reorder_level),
        is_active: Set(true),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let created = model.insert(db).await?;

    // Every product gets a zeroed stock_balances row at creation time so
    // stock_service can always UPDATE rather than needing an upsert branch
    // on every single inward/outward/adjustment.
    let balance = stock_balance::ActiveModel {
        product_id: Set(id),
        quantity_on_hand: Set(0.0),
        updated_at: Set(now),
    };
    balance.insert(db).await?;

    Ok(created)
}

pub async fn update(
    db: &DatabaseConnection,
    id: Uuid,
    input: UpdateProductInput,
) -> AppResult<product::Model> {
    if input.sku.trim().is_empty() {
        return Err(AppError::Validation("SKU is required".into()));
    }
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("product name is required".into()));
    }
    if input.reorder_level < 0.0 {
        return Err(AppError::Validation(
            "reorder level cannot be negative".into(),
        ));
    }

    ensure_unit_exists(db, input.base_unit_id).await?;
    ensure_sku_unique(db, &input.sku, Some(id)).await?;

    let existing = get(db, id).await?;
    let mut active: product::ActiveModel = existing.into();
    active.sku = Set(input.sku);
    active.name = Set(input.name);
    active.description = Set(input.description);
    active.base_unit_id = Set(input.base_unit_id);
    active.specifications = Set(input.specifications);
    active.reorder_level = Set(input.reorder_level);
    active.is_active = Set(input.is_active);
    active.updated_at = Set(Utc::now().naive_utc());

    Ok(active.update(db).await?)
}

/// Products are never hard-deleted -- too much history (stock movements,
/// dispatch items, reels) points at them, and losing that trail would
/// break "full stock history log". Deactivating hides it from active
/// pickers/lists while keeping every past record intact.
pub async fn deactivate(db: &DatabaseConnection, id: Uuid) -> AppResult<product::Model> {
    let existing = get(db, id).await?;
    let mut active: product::ActiveModel = existing.into();
    active.is_active = Set(false);
    active.updated_at = Set(Utc::now().naive_utc());
    Ok(active.update(db).await?)
}
