use sea_orm::entity::prelude::*;
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "packing_slips")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub party_name: String,
    pub invoice_no: String,
    pub date: String,
    pub tempo_no: Option<String>,
    pub total_parcel: Option<String>,
    /// JSON array of line item objects
    pub line_items: serde_json::Value,
    pub total_gross: f64,
    pub total_tare: f64,
    pub total_net: f64,
    pub created_by: Uuid,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
