use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "stock_movements")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub product_id: Uuid,
    /// inward | outward | adjustment -- validated against
    /// `erp_core::domain::StockMovementType` at the service layer.
    pub movement_type: String,
    #[sea_orm(column_type = "Double")]
    pub quantity: f64,
    #[sea_orm(column_type = "Double", nullable)]
    pub adjustment_delta: Option<f64>,
    pub dispatch_id: Option<Uuid>,
    pub reference_number: Option<String>,
    pub remarks: Option<String>,
    pub performed_by: Uuid,
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::product::Entity",
        from = "Column::ProductId",
        to = "super::product::Column::Id"
    )]
    Product,
    #[sea_orm(
        belongs_to = "super::dispatch::Entity",
        from = "Column::DispatchId",
        to = "super::dispatch::Column::Id"
    )]
    Dispatch,
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::PerformedBy",
        to = "super::user::Column::Id"
    )]
    PerformedByUser,
}

impl Related<super::product::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Product.def()
    }
}

impl Related<super::dispatch::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dispatch.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::PerformedByUser.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
