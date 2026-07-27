use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "reel_movements")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub reel_id: Uuid,
    /// created | dispatched | returned | lost | damaged -- validated
    /// against `erp_core::domain::ReelEventType` at the service layer.
    pub event_type: String,
    pub dispatch_id: Option<Uuid>,
    pub customer_id: Option<Uuid>,
    pub remarks: Option<String>,
    pub performed_by: Uuid,
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::reel::Entity",
        from = "Column::ReelId",
        to = "super::reel::Column::Id"
    )]
    Reel,
    #[sea_orm(
        belongs_to = "super::dispatch::Entity",
        from = "Column::DispatchId",
        to = "super::dispatch::Column::Id"
    )]
    Dispatch,
    #[sea_orm(
        belongs_to = "super::customer::Entity",
        from = "Column::CustomerId",
        to = "super::customer::Column::Id"
    )]
    Customer,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::PerformedBy",
        to = "super::user::Column::Id"
    )]
    PerformedByUser,
}

impl Related<super::reel::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Reel.def()
    }
}

impl Related<super::dispatch::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dispatch.def()
    }
}

impl Related<super::customer::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Customer.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::PerformedByUser.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
