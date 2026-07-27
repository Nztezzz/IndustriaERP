use crate::entities::unit;
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

pub struct CreateUnitInput {
    pub name: String,
    pub symbol: String,
    pub conversion_factor: f32,
}

pub struct UpdateUnitInput {
    pub name: String,
    pub symbol: String,
    pub conversion_factor: f32,
}

pub async fn list(db: &DatabaseConnection) -> AppResult<Vec<unit::Model>> {
    Ok(unit::Entity::find()
        .order_by_asc(unit::Column::Name)
        .all(db)
        .await?)
}

pub async fn get(db: &DatabaseConnection, id: Uuid) -> AppResult<unit::Model> {
    unit::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("unit {id} not found")))
}

pub async fn create(db: &DatabaseConnection, input: CreateUnitInput) -> AppResult<unit::Model> {
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("unit name is required".into()));
    }
    if input.symbol.trim().is_empty() {
        return Err(AppError::Validation("unit symbol is required".into()));
    }
    if input.conversion_factor <= 0.0 {
        return Err(AppError::Validation(
            "conversion factor must be greater than zero".into(),
        ));
    }

    let existing = unit::Entity::find()
        .filter(unit::Column::Name.eq(input.name.clone()))
        .one(db)
        .await?;
    if existing.is_some() {
        return Err(AppError::Conflict(format!(
            "a unit named '{}' already exists",
            input.name
        )));
    }

    let model = unit::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(input.name),
        symbol: Set(input.symbol),
        conversion_factor: Set(input.conversion_factor),
        created_at: Set(Utc::now().naive_utc()),
    };

    Ok(model.insert(db).await?)
}

pub async fn update(
    db: &DatabaseConnection,
    id: Uuid,
    input: UpdateUnitInput,
) -> AppResult<unit::Model> {
    let existing = get(db, id).await?;
    let mut active: unit::ActiveModel = existing.into();
    active.name = Set(input.name);
    active.symbol = Set(input.symbol);
    active.conversion_factor = Set(input.conversion_factor);
    Ok(active.update(db).await?)
}

/// Deletes a unit. Fails with `Conflict` (rather than a raw FK-violation
/// database error) if any product still references it, since "delete this
/// unit" is a mistake an operator can make from the UI and deserves a
/// readable message, not a SQLite error code.
pub async fn delete(db: &DatabaseConnection, id: Uuid) -> AppResult<()> {
    use crate::entities::product;

    let in_use = product::Entity::find()
        .filter(product::Column::BaseUnitId.eq(id))
        .one(db)
        .await?
        .is_some();

    if in_use {
        return Err(AppError::Conflict(
            "cannot delete a unit that is still used by one or more products".into(),
        ));
    }

    unit::Entity::delete_by_id(id).exec(db).await?;
    Ok(())
}
