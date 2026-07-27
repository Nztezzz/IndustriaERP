use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "reels")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub reel_number: String,
    pub product_id: Uuid,
    /// in_stock | dispatched | returned | lost | damaged -- validated
    /// against `erp_core::domain::ReelStatus` at the service layer.
    pub status: String,
    pub current_customer_id: Option<Uuid>,
    #[sea_orm(column_type = "Double", nullable)]
    pub weight_kg: Option<f64>,
    pub created_at: DateTime,
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
    #[sea_orm(
        belongs_to = "super::customer::Entity",
        from = "Column::CurrentCustomerId",
        to = "super::customer::Column::Id"
    )]
    CurrentCustomer,
    #[sea_orm(has_many = "super::reel_movement::Entity")]
    ReelMovement,
}

impl Related<super::product::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Product.def()
    }
}

impl Related<super::customer::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CurrentCustomer.def()
    }
}

impl Related<super::reel_movement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ReelMovement.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
