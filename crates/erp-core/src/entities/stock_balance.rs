use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "stock_balances")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub product_id: Uuid,
    #[sea_orm(column_type = "Double")]
    pub quantity_on_hand: f64,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::product::Entity",
        from = "Column::ProductId",
        to = "super::product::Column::Id"
    )]
    Product,
}

impl Related<super::product::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Product.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
