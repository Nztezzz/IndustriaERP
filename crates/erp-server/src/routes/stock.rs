use crate::error::{ApiError, ApiResult};
use crate::extractors::{CurrentUser, OperatorUser};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::NaiveDateTime;
use erp_core::services::stock_service;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/stock/balances", get(balances))
        .route("/stock/movements", get(movements))
        .route("/stock/movements/{id}", get(get_movement))
        .route("/stock/movements/delete", post(delete_movements))
        .route("/stock/inward", post(inward))
        .route("/stock/outward", post(outward))
        .route("/stock/adjustment", post(adjustment))
}

#[derive(Serialize)]
struct StockBalanceDto {
    #[serde(rename = "productId")]
    product_id: Uuid,
    #[serde(rename = "productName")]
    product_name: String,
    #[serde(rename = "productSku")]
    product_sku: String,
    #[serde(rename = "unitSymbol")]
    unit_symbol: String,
    #[serde(rename = "quantityOnHand")]
    quantity_on_hand: f64,
    #[serde(rename = "reorderLevel")]
    reorder_level: f64,
    #[serde(rename = "isLowStock")]
    is_low_stock: bool,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

impl From<stock_service::StockBalanceView> for StockBalanceDto {
    fn from(v: stock_service::StockBalanceView) -> Self {
        Self {
            product_id: v.product.id,
            product_name: v.product.name,
            product_sku: v.product.sku,
            unit_symbol: v.unit_symbol,
            quantity_on_hand: v.quantity_on_hand,
            reorder_level: v.product.reorder_level,
            is_low_stock: v.is_low_stock,
            updated_at: v.updated_at.to_string(),
        }
    }
}

#[derive(Serialize)]
struct StockMovementDto {
    id: Uuid,
    #[serde(rename = "productId")]
    product_id: Uuid,
    #[serde(rename = "movementType")]
    movement_type: String,
    quantity: f64,
    #[serde(rename = "adjustmentDelta")]
    adjustment_delta: Option<f64>,
    #[serde(rename = "dispatchId")]
    dispatch_id: Option<Uuid>,
    #[serde(rename = "referenceNumber")]
    reference_number: Option<String>,
    remarks: Option<String>,
    #[serde(rename = "performedBy")]
    performed_by: Uuid,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<erp_core::entities::stock_movement::Model> for StockMovementDto {
    fn from(m: erp_core::entities::stock_movement::Model) -> Self {
        Self {
            id: m.id,
            product_id: m.product_id,
            movement_type: m.movement_type,
            quantity: m.quantity,
            adjustment_delta: m.adjustment_delta,
            dispatch_id: m.dispatch_id,
            reference_number: m.reference_number,
            remarks: m.remarks,
            performed_by: m.performed_by,
            created_at: m.created_at.to_string(),
        }
    }
}

#[derive(Serialize)]
struct PagedMovements {
    items: Vec<StockMovementDto>,
    total: u64,
    page: u64,
    #[serde(rename = "pageSize")]
    page_size: u64,
}

#[derive(Deserialize)]
struct MovementsQuery {
    #[serde(rename = "productId")]
    product_id: Option<Uuid>,
    #[serde(rename = "movementType")]
    movement_type: Option<String>,
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
    #[serde(default)]
    page: u64,
    #[serde(rename = "pageSize", default = "default_page_size")]
    page_size: u64,
}

fn default_page_size() -> u64 {
    50
}

#[derive(Deserialize)]
struct InwardRequest {
    #[serde(rename = "productId")]
    product_id: Uuid,
    quantity: f64,
    #[serde(rename = "referenceNumber")]
    reference_number: Option<String>,
    remarks: Option<String>,
}

#[derive(Deserialize)]
struct OutwardRequest {
    #[serde(rename = "productId")]
    product_id: Uuid,
    quantity: f64,
    #[serde(rename = "referenceNumber")]
    reference_number: Option<String>,
    remarks: Option<String>,
}

#[derive(Deserialize)]
struct AdjustmentRequest {
    #[serde(rename = "productId")]
    product_id: Uuid,
    delta: f64,
    remarks: String,
}

async fn balances(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> ApiResult<Json<Vec<StockBalanceDto>>> {
    let balances = stock_service::list_balances(&state.db).await.map_err(ApiError)?;
    Ok(Json(balances.into_iter().map(StockBalanceDto::from).collect()))
}

async fn movements(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Query(query): Query<MovementsQuery>,
) -> ApiResult<Json<PagedMovements>> {
    let movement_type = query
        .movement_type
        .as_deref()
        .map(std::str::FromStr::from_str)
        .transpose()
        .map_err(|e: String| ApiError(erp_core::AppError::Validation(e)))?;

    let (rows, total) = stock_service::list_movements(
        &state.db,
        stock_service::MovementFilter {
            product_id: query.product_id,
            movement_type,
            from: query.from,
            to: query.to,
        },
        query.page,
        query.page_size,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(PagedMovements {
        items: rows.into_iter().map(StockMovementDto::from).collect(),
        total,
        page: query.page,
        page_size: query.page_size,
    }))
}

async fn get_movement(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<StockMovementDto>> {
    use erp_core::entities::stock_movement;

    let movement = stock_movement::Entity::find_by_id(id)
        .one(&*state.db)
        .await
        .map_err(erp_core::AppError::from)
        .map_err(ApiError)?
        .ok_or(erp_core::AppError::NotFound(format!("stock movement {id} not found")))
        .map_err(ApiError)?;

    Ok(Json(movement.into()))
}

#[derive(Deserialize)]
struct DeleteMovementsRequest {
    ids: Vec<Uuid>,
}

async fn delete_movements(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Json(body): Json<DeleteMovementsRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    use erp_core::entities::stock_movement;

    if body.ids.is_empty() {
        return Ok(Json(serde_json::json!({ "deleted": 0 })));
    }

    let result = stock_movement::Entity::delete_many()
        .filter(stock_movement::Column::Id.is_in(body.ids.clone()))
        .exec(&*state.db)
        .await
        .map_err(erp_core::AppError::from)
        .map_err(ApiError)?;

    Ok(Json(serde_json::json!({ "deleted": result.rows_affected })))
}

async fn inward(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Json(body): Json<InwardRequest>,
) -> ApiResult<Json<StockMovementDto>> {
    let movement = stock_service::record_inward(
        &state.db,
        stock_service::InwardInput {
            product_id: body.product_id,
            quantity: body.quantity,
            reference_number: body.reference_number,
            remarks: body.remarks,
        },
        user.user_id,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(movement.into()))
}

async fn outward(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Json(body): Json<OutwardRequest>,
) -> ApiResult<Json<StockMovementDto>> {
    let movement = stock_service::record_outward(
        &state.db,
        stock_service::OutwardInput {
            product_id: body.product_id,
            quantity: body.quantity,
            reference_number: body.reference_number,
            remarks: body.remarks,
            dispatch_id: None,
        },
        user.user_id,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(movement.into()))
}

async fn adjustment(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Json(body): Json<AdjustmentRequest>,
) -> ApiResult<Json<StockMovementDto>> {
    let movement = stock_service::record_adjustment(
        &state.db,
        stock_service::AdjustmentInput {
            product_id: body.product_id,
            delta: body.delta,
            remarks: body.remarks,
        },
        user.user_id,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(movement.into()))
}
