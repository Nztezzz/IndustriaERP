use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "dispatches")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub invoice_number: String,
    pub customer_id: Uuid,
    pub vehicle_number: Option<String>,
    pub driver_name: Option<String>,
    pub driver_phone: Option<String>,
    pub dispatch_date: DateTime,
    /// pending | delivered | cancelled -- validated against
    /// `erp_core::domain::DispatchStatus` at the service layer.
    pub status: String,
    #[sea_orm(column_type = "Double", nullable)]
    pub total_weight_kg: Option<f64>,
    pub remarks: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::customer::Entity",
        from = "Column::CustomerId",
        to = "super::customer::Column::Id"
    )]
    Customer,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id"
    )]
    CreatedByUser,
    #[sea_orm(has_many = "super::dispatch_item::Entity")]
    DispatchItem,
    #[sea_orm(has_many = "super::reel_movement::Entity")]
    ReelMovement,
    #[sea_orm(has_many = "super::stock_movement::Entity")]
    StockMovement,
}

impl Related<super::customer::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Customer.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CreatedByUser.def()
    }
}

impl Related<super::dispatch_item::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DispatchItem.def()
    }
}

impl Related<super::reel_movement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ReelMovement.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
