use crate::error::{ApiError, ApiResult};
use crate::extractors::CurrentUser;
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use chrono::Utc;
use erp_core::entities::packing_slip;
use erp_core::AppError;
use sea_orm::{ActiveModelTrait, EntityTrait, QueryOrder, Set};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/packing-slips", get(list).post(create))
        .route("/packing-slips/{id}", get(get_one))
}

#[derive(Serialize)]
struct PackingSlipDto {
    id: Uuid,
    #[serde(rename = "partyName")]
    party_name: String,
    #[serde(rename = "invoiceNo")]
    invoice_no: String,
    date: String,
    #[serde(rename = "tempoNo")]
    tempo_no: Option<String>,
    #[serde(rename = "totalParcel")]
    total_parcel: Option<String>,
    #[serde(rename = "lineItems")]
    line_items: serde_json::Value,
    #[serde(rename = "totalGross")]
    total_gross: f64,
    #[serde(rename = "totalTare")]
    total_tare: f64,
    #[serde(rename = "totalNet")]
    total_net: f64,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<packing_slip::Model> for PackingSlipDto {
    fn from(m: packing_slip::Model) -> Self {
        Self {
            id: m.id,
            party_name: m.party_name,
            invoice_no: m.invoice_no,
            date: m.date,
            tempo_no: m.tempo_no,
            total_parcel: m.total_parcel,
            line_items: m.line_items,
            total_gross: m.total_gross,
            total_tare: m.total_tare,
            total_net: m.total_net,
            created_at: m.created_at.to_string(),
        }
    }
}

#[derive(Deserialize)]
struct CreateRequest {
    #[serde(rename = "partyName")]
    party_name: String,
    #[serde(rename = "invoiceNo")]
    invoice_no: String,
    date: String,
    #[serde(rename = "tempoNo")]
    tempo_no: Option<String>,
    #[serde(rename = "totalParcel")]
    total_parcel: Option<String>,
    #[serde(rename = "lineItems")]
    line_items: serde_json::Value,
    #[serde(rename = "totalGross")]
    total_gross: f64,
    #[serde(rename = "totalTare")]
    total_tare: f64,
    #[serde(rename = "totalNet")]
    total_net: f64,
}

async fn create(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
    Json(body): Json<CreateRequest>,
) -> ApiResult<Json<PackingSlipDto>> {
    let id = Uuid::new_v4();
    let now = Utc::now().naive_utc();

    let model = packing_slip::ActiveModel {
        id: Set(id),
        party_name: Set(body.party_name),
        invoice_no: Set(body.invoice_no),
        date: Set(body.date),
        tempo_no: Set(body.tempo_no),
        total_parcel: Set(body.total_parcel),
        line_items: Set(body.line_items),
        total_gross: Set(body.total_gross),
        total_tare: Set(body.total_tare),
        total_net: Set(body.total_net),
        created_by: Set(user.user_id),
        created_at: Set(now),
    };

    let record = model.insert(&*state.db).await.map_err(AppError::from).map_err(ApiError)?;
    Ok(Json(record.into()))
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> ApiResult<Json<Vec<PackingSlipDto>>> {
    let rows = packing_slip::Entity::find()
        .order_by_desc(packing_slip::Column::CreatedAt)
        .all(&*state.db)
        .await
        .map_err(AppError::from)
        .map_err(ApiError)?;

    Ok(Json(rows.into_iter().map(PackingSlipDto::from).collect()))
}

async fn get_one(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<PackingSlipDto>> {
    let record = packing_slip::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(AppError::from)
        .map_err(ApiError)?
        .ok_or(AppError::NotFound(format!("packing slip {id} not found")))
        .map_err(ApiError)?;

    Ok(Json(record.into()))
}
