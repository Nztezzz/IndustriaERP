use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "products")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub sku: String,
    pub name: String,
    pub description: Option<String>,
    pub base_unit_id: Uuid,
    /// Free-form spec sheet (e.g. `{"gsm": "80", "width_mm": "1000"}`).
    pub specifications: Option<Json>,
    #[sea_orm(column_type = "Double")]
    pub reorder_level: f64,
    pub is_active: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::unit::Entity",
        from = "Column::BaseUnitId",
        to = "super::unit::Column::Id"
    )]
    Unit,
    #[sea_orm(has_many = "super::reel::Entity")]
    Reel,
    #[sea_orm(has_many = "super::stock_movement::Entity")]
    StockMovement,
    #[sea_orm(has_many = "super::dispatch_item::Entity")]
    DispatchItem,
    #[sea_orm(has_one = "super::stock_balance::Entity")]
    StockBalance,
}

impl Related<super::unit::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Unit.def()
    }
}

impl Related<super::reel::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Reel.def()
    }
}

impl Related<super::stock_movement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::StockMovement.def()
    }
}

impl Related<super::dispatch_item::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DispatchItem.def()
    }
}

impl Related<super::stock_balance::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::StockBalance.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
