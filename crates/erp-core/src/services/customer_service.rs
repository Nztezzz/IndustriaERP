use crate::entities::customer;
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set};
use uuid::Uuid;

pub struct CreateCustomerInput {
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gst_number: Option<String>,
}

pub struct UpdateCustomerInput {
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gst_number: Option<String>,
    pub is_active: bool,
}

pub async fn list(db: &DatabaseConnection, include_inactive: bool) -> AppResult<Vec<customer::Model>> {
    let mut query = customer::Entity::find();
    if !include_inactive {
        query = query.filter(customer::Column::IsActive.eq(true));
    }
    Ok(query.order_by_asc(customer::Column::Name).all(db).await?)
}

pub async fn get(db: &DatabaseConnection, id: Uuid) -> AppResult<customer::Model> {
    customer::Entity::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("customer {id} not found")))
}

pub async fn create(
    db: &DatabaseConnection,
    input: CreateCustomerInput,
) -> AppResult<customer::Model> {
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("customer name is required".into()));
    }

    let now = Utc::now().naive_utc();
    let model = customer::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(input.name),
        contact_person: Set(input.contact_person),
        phone: Set(input.phone),
        email: Set(input.email),
        address: Set(input.address),
        gst_number: Set(input.gst_number),
        is_active: Set(true),
        created_at: Set(now),
        updated_at: Set(now),
    };

    Ok(model.insert(db).await?)
}

pub async fn update(
    db: &DatabaseConnection,
    id: Uuid,
    input: UpdateCustomerInput,
) -> AppResult<customer::Model> {
    if input.name.trim().is_empty() {
        return Err(AppError::Validation("customer name is required".into()));
    }

    let existing = get(db, id).await?;
    let mut active: customer::ActiveModel = existing.into();
    active.name = Set(input.name);
    active.contact_person = Set(input.contact_person);
    active.phone = Set(input.phone);
    active.email = Set(input.email);
    active.address = Set(input.address);
    active.gst_number = Set(input.gst_number);
    active.is_active = Set(input.is_active);
    active.updated_at = Set(Utc::now().naive_utc());

    Ok(active.update(db).await?)
}
