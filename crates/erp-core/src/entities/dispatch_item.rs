use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "dispatch_items")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub dispatch_id: Uuid,
    pub product_id: Uuid,
    #[sea_orm(column_type = "Double")]
    pub quantity: f64,
    #[sea_orm(column_type = "Double", nullable)]
    pub weight_kg: Option<f64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::dispatch::Entity",
        from = "Column::DispatchId",
        to = "super::dispatch::Column::Id"
    )]
    Dispatch,
    #[sea_orm(
        belongs_to = "super::product::Entity",
        from = "Column::ProductId",
        to = "super::product::Column::Id"
    )]
    Product,
}

impl Related<super::dispatch::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dispatch.def()
    }
}

impl Related<super::product::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Product.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
