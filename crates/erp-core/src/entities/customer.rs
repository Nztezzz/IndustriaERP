use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "customers")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub contact_person: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub gst_number: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::dispatch::Entity")]
    Dispatch,
    #[sea_orm(has_many = "super::reel::Entity")]
    Reel,
    #[sea_orm(has_many = "super::reel_movement::Entity")]
    ReelMovement,
}

impl Related<super::dispatch::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dispatch.def()
    }
}

impl Related<super::reel::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Reel.def()
    }
}

impl Related<super::reel_movement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ReelMovement.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
