use crate::error::{ApiError, ApiResult};
use crate::extractors::{CurrentUser, OperatorUser};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use erp_core::services::reel_service;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/reels", get(list).post(register))
        .route("/reels/{reelNumber}", get(get_one))
        .route("/reels/{reelNumber}/history", get(history))
        .route("/reels/{reelNumber}/return", post(return_reel))
        .route("/reels/{reelNumber}/mark-lost", post(mark_lost))
        .route("/reels/{reelNumber}/mark-damaged", post(mark_damaged))
}

#[derive(Serialize)]
struct ReelDto {
    id: Uuid,
    #[serde(rename = "reelNumber")]
    reel_number: String,
    #[serde(rename = "productId")]
    product_id: Uuid,
    status: String,
    #[serde(rename = "currentCustomerId")]
    current_customer_id: Option<Uuid>,
    #[serde(rename = "weightKg")]
    weight_kg: Option<f64>,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

impl From<erp_core::entities::reel::Model> for ReelDto {
    fn from(m: erp_core::entities::reel::Model) -> Self {
        Self {
            id: m.id,
            reel_number: m.reel_number,
            product_id: m.product_id,
            status: m.status,
            current_customer_id: m.current_customer_id,
            weight_kg: m.weight_kg,
            created_at: m.created_at.to_string(),
            updated_at: m.updated_at.to_string(),
        }
    }
}

#[derive(Serialize)]
struct ReelMovementDto {
    id: Uuid,
    #[serde(rename = "eventType")]
    event_type: String,
    #[serde(rename = "dispatchId")]
    dispatch_id: Option<Uuid>,
    #[serde(rename = "customerId")]
    customer_id: Option<Uuid>,
    remarks: Option<String>,
    #[serde(rename = "performedBy")]
    performed_by: Uuid,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<erp_core::entities::reel_movement::Model> for ReelMovementDto {
    fn from(m: erp_core::entities::reel_movement::Model) -> Self {
        Self {
            id: m.id,
            event_type: m.event_type,
            dispatch_id: m.dispatch_id,
            customer_id: m.customer_id,
            remarks: m.remarks,
            performed_by: m.performed_by,
            created_at: m.created_at.to_string(),
        }
    }
}

#[derive(Serialize)]
struct PagedReels {
    items: Vec<ReelDto>,
    total: u64,
    page: u64,
    #[serde(rename = "pageSize")]
    page_size: u64,
}

#[derive(Deserialize)]
struct ListQuery {
    status: Option<String>,
    #[serde(rename = "customerId")]
    customer_id: Option<Uuid>,
    #[serde(rename = "productId")]
    product_id: Option<Uuid>,
    #[serde(default)]
    page: u64,
    #[serde(rename = "pageSize", default = "default_page_size")]
    page_size: u64,
}

fn default_page_size() -> u64 {
    50
}

#[derive(Deserialize)]
struct RegisterReelRequest {
    #[serde(rename = "reelNumber")]
    reel_number: String,
    #[serde(rename = "productId")]
    product_id: Uuid,
    #[serde(rename = "weightKg")]
    weight_kg: Option<f64>,
}

#[derive(Deserialize)]
struct ReturnReelRequest {
    remarks: Option<String>,
}

#[derive(Deserialize)]
struct MarkLostOrDamagedRequest {
    remarks: String,
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<PagedReels>> {
    let status = query
        .status
        .as_deref()
        .map(std::str::FromStr::from_str)
        .transpose()
        .map_err(|e: String| ApiError(erp_core::AppError::Validation(e)))?;

    let (rows, total) = reel_service::list(
        &state.db,
        reel_service::ReelFilter {
            status,
            customer_id: query.customer_id,
            product_id: query.product_id,
        },
        query.page,
        query.page_size,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(PagedReels {
        items: rows.into_iter().map(ReelDto::from).collect(),
        total,
        page: query.page,
        page_size: query.page_size,
    }))
}

async fn get_one(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(reel_number): Path<String>,
) -> ApiResult<Json<ReelDto>> {
    let reel = reel_service::get_by_reel_number(&state.db, &reel_number)
        .await
        .map_err(ApiError)?;
    Ok(Json(reel.into()))
}

async fn history(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(reel_number): Path<String>,
) -> ApiResult<Json<Vec<ReelMovementDto>>> {
    let reel = reel_service::get_by_reel_number(&state.db, &reel_number)
        .await
        .map_err(ApiError)?;
    let history = reel_service::history_for_reel(&state.db, reel.id)
        .await
        .map_err(ApiError)?;
    Ok(Json(history.into_iter().map(ReelMovementDto::from).collect()))
}

async fn register(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Json(body): Json<RegisterReelRequest>,
) -> ApiResult<Json<ReelDto>> {
    let reel = reel_service::register(
        &state.db,
        reel_service::RegisterReelInput {
            reel_number: body.reel_number,
            product_id: body.product_id,
            weight_kg: body.weight_kg,
        },
        user.user_id,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(reel.into()))
}

async fn return_reel(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Path(reel_number): Path<String>,
    Json(body): Json<ReturnReelRequest>,
) -> ApiResult<Json<ReelDto>> {
    let reel = reel_service::get_by_reel_number(&state.db, &reel_number)
        .await
        .map_err(ApiError)?;

    let updated = reel_service::return_reel(
        &state.db,
        reel_service::ReturnReelInput {
            reel_id: reel.id,
            remarks: body.remarks,
        },
        user.user_id,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(updated.into()))
}

async fn mark_lost(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Path(reel_number): Path<String>,
    Json(body): Json<MarkLostOrDamagedRequest>,
) -> ApiResult<Json<ReelDto>> {
    mark_lost_or_damaged_impl(state, user.user_id, reel_number, body.remarks, false).await
}

async fn mark_damaged(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Path(reel_number): Path<String>,
    Json(body): Json<MarkLostOrDamagedRequest>,
) -> ApiResult<Json<ReelDto>> {
    mark_lost_or_damaged_impl(state, user.user_id, reel_number, body.remarks, true).await
}

async fn mark_lost_or_damaged_impl(
    state: AppState,
    performed_by: Uuid,
    reel_number: String,
    remarks: String,
    damaged: bool,
) -> ApiResult<Json<ReelDto>> {
    let reel = reel_service::get_by_reel_number(&state.db, &reel_number)
        .await
        .map_err(ApiError)?;

    let updated = reel_service::mark_lost_or_damaged(
        &state.db,
        reel_service::MarkLostOrDamagedInput {
            reel_id: reel.id,
            damaged,
            remarks,
        },
        performed_by,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(updated.into()))
}
