use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
    pub full_name: String,
    pub role_name: String,
    pub is_active: bool,
    pub last_login_at: Option<DateTime>,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::role::Entity",
        from = "Column::RoleName",
        to = "super::role::Column::Name"
    )]
    Role,
    #[sea_orm(has_many = "super::dispatch::Entity")]
    Dispatch,
    #[sea_orm(has_many = "super::stock_movement::Entity")]
    StockMovement,
    #[sea_orm(has_many = "super::reel_movement::Entity")]
    ReelMovement,
    #[sea_orm(has_many = "super::audit_log::Entity")]
    AuditLog,
    #[sea_orm(has_many = "super::backup::Entity")]
    Backup,
}

impl Related<super::role::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Role.def()
    }
}

impl Related<super::dispatch::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Dispatch.def()
    }
}

impl Related<super::stock_movement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::StockMovement.def()
    }
}

impl Related<super::reel_movement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ReelMovement.def()
    }
}

impl Related<super::audit_log::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::AuditLog.def()
    }
}

impl Related<super::backup::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Backup.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
