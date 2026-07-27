use crate::error::{ApiError, ApiResult};
use crate::extractors::{CurrentUser, OperatorUser};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use erp_core::services::{customer_service, reel_service};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/customers", get(list).post(create))
        .route("/customers/{id}", get(get_one).put(update))
        .route("/customers/{id}/reel-history", get(reel_history))
}

#[derive(Serialize)]
struct CustomerDto {
    id: Uuid,
    name: String,
    #[serde(rename = "contactPerson")]
    contact_person: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    #[serde(rename = "gstNumber")]
    gst_number: Option<String>,
    #[serde(rename = "isActive")]
    is_active: bool,
}

impl From<erp_core::entities::customer::Model> for CustomerDto {
    fn from(m: erp_core::entities::customer::Model) -> Self {
        Self {
            id: m.id,
            name: m.name,
            contact_person: m.contact_person,
            phone: m.phone,
            email: m.email,
            address: m.address,
            gst_number: m.gst_number,
            is_active: m.is_active,
        }
    }
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "includeInactive", default)]
    include_inactive: bool,
}

#[derive(Deserialize)]
struct CustomerRequest {
    name: String,
    #[serde(rename = "contactPerson")]
    contact_person: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    #[serde(rename = "gstNumber")]
    gst_number: Option<String>,
    #[serde(rename = "isActive", default = "default_true")]
    is_active: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize)]
struct ReelMovementDto {
    id: Uuid,
    #[serde(rename = "reelId")]
    reel_id: Uuid,
    #[serde(rename = "reelNumber")]
    reel_number: String,
    #[serde(rename = "productName")]
    product_name: String,
    #[serde(rename = "eventType")]
    event_type: String,
    #[serde(rename = "dispatchId")]
    dispatch_id: Option<Uuid>,
    remarks: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<reel_service::CustomerReelMovement> for ReelMovementDto {
    fn from(row: reel_service::CustomerReelMovement) -> Self {
        Self {
            id: row.movement.id,
            reel_id: row.movement.reel_id,
            reel_number: row.reel_number,
            product_name: row.product_name,
            event_type: row.movement.event_type,
            dispatch_id: row.movement.dispatch_id,
            remarks: row.movement.remarks,
            created_at: row.movement.created_at.to_string(),
        }
    }
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Vec<CustomerDto>>> {
    let customers = customer_service::list(&state.db, query.include_inactive)
        .await
        .map_err(ApiError)?;
    Ok(Json(customers.into_iter().map(CustomerDto::from).collect()))
}

async fn get_one(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<CustomerDto>> {
    let customer = customer_service::get(&state.db, id).await.map_err(ApiError)?;
    Ok(Json(customer.into()))
}

async fn create(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Json(body): Json<CustomerRequest>,
) -> ApiResult<Json<CustomerDto>> {
    let created = customer_service::create(
        &state.db,
        customer_service::CreateCustomerInput {
            name: body.name,
            contact_person: body.contact_person,
            phone: body.phone,
            email: body.email,
            address: body.address,
            gst_number: body.gst_number,
        },
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(created.into()))
}

async fn update(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CustomerRequest>,
) -> ApiResult<Json<CustomerDto>> {
    let updated = customer_service::update(
        &state.db,
        id,
        customer_service::UpdateCustomerInput {
            name: body.name,
            contact_person: body.contact_person,
            phone: body.phone,
            email: body.email,
            address: body.address,
            gst_number: body.gst_number,
            is_active: body.is_active,
        },
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(updated.into()))
}

/// Customer-wise reel history: every dispatch/return/lost/damaged event
/// involving this customer's reels, newest first.
async fn reel_history(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<Vec<ReelMovementDto>>> {
    let history = reel_service::history_for_customer(&state.db, id)
        .await
        .map_err(ApiError)?;
    Ok(Json(history.into_iter().map(ReelMovementDto::from).collect()))
}
