use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "backups")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub file_path: String,
    pub file_size_bytes: i64,
    /// manual | scheduled -- validated against
    /// `erp_core::domain::BackupTrigger` at the service layer.
    pub trigger_type: String,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::CreatedBy",
        to = "super::user::Column::Id"
    )]
    CreatedByUser,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CreatedByUser.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
