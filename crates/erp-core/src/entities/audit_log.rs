use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "audit_logs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// e.g. "stock_movement", "user", "reel" -- the table/domain concept
    /// being audited, not necessarily a literal table name.
    pub entity_type: String,
    /// Stored as text since the referenced entity's PK type varies
    /// (usually a UUID string, but kept generic for e.g. role names).
    pub entity_id: String,
    /// e.g. "create", "update", "delete", "adjust", "login".
    pub action: String,
    pub performed_by: Uuid,
    pub before_state: Option<Json>,
    pub after_state: Option<Json>,
    pub changes_summary: Option<String>,
    pub created_at: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::PerformedBy",
        to = "super::user::Column::Id"
    )]
    PerformedByUser,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::PerformedByUser.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
