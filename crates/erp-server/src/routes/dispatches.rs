use crate::error::{ApiError, ApiResult};
use crate::extractors::{CurrentUser, OperatorUser};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use chrono::NaiveDateTime;
use erp_core::services::dispatch_service;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/dispatches", get(list).post(create))
        .route("/dispatches/{id}", get(get_one))
}

#[derive(Serialize)]
struct DispatchItemDto {
    id: Uuid,
    #[serde(rename = "productId")]
    product_id: Uuid,
    quantity: f64,
    #[serde(rename = "weightKg")]
    weight_kg: Option<f64>,
}

impl From<erp_core::entities::dispatch_item::Model> for DispatchItemDto {
    fn from(m: erp_core::entities::dispatch_item::Model) -> Self {
        Self {
            id: m.id,
            product_id: m.product_id,
            quantity: m.quantity,
            weight_kg: m.weight_kg,
        }
    }
}

#[derive(Serialize)]
struct DispatchDto {
    id: Uuid,
    #[serde(rename = "invoiceNumber")]
    invoice_number: String,
    #[serde(rename = "customerId")]
    customer_id: Uuid,
    #[serde(rename = "customerName")]
    customer_name: String,
    #[serde(rename = "vehicleNumber")]
    vehicle_number: Option<String>,
    #[serde(rename = "driverName")]
    driver_name: Option<String>,
    #[serde(rename = "driverPhone")]
    driver_phone: Option<String>,
    #[serde(rename = "dispatchDate")]
    dispatch_date: String,
    status: String,
    #[serde(rename = "totalWeightKg")]
    total_weight_kg: Option<f64>,
    remarks: Option<String>,
    items: Vec<DispatchItemDto>,
    #[serde(rename = "reelNumbers")]
    reel_numbers: Vec<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<dispatch_service::DispatchWithDetails> for DispatchDto {
    fn from(d: dispatch_service::DispatchWithDetails) -> Self {
        Self {
            id: d.dispatch.id,
            invoice_number: d.dispatch.invoice_number,
            customer_id: d.dispatch.customer_id,
            customer_name: d.customer_name,
            vehicle_number: d.dispatch.vehicle_number,
            driver_name: d.dispatch.driver_name,
            driver_phone: d.dispatch.driver_phone,
            dispatch_date: d.dispatch.dispatch_date.to_string(),
            status: d.dispatch.status,
            total_weight_kg: d.dispatch.total_weight_kg,
            remarks: d.dispatch.remarks,
            items: d.items.into_iter().map(DispatchItemDto::from).collect(),
            reel_numbers: d.reel_numbers,
            created_at: d.dispatch.created_at.to_string(),
        }
    }
}

/// Lightweight row shape for the list view -- avoids resolving items/reels
/// for every row in a paginated list, which the detail endpoint already
/// covers via `get_one`.
#[derive(Serialize)]
struct DispatchListItemDto {
    id: Uuid,
    #[serde(rename = "invoiceNumber")]
    invoice_number: String,
    #[serde(rename = "customerId")]
    customer_id: Uuid,
    #[serde(rename = "dispatchDate")]
    dispatch_date: String,
    status: String,
    #[serde(rename = "totalWeightKg")]
    total_weight_kg: Option<f64>,
}

impl From<erp_core::entities::dispatch::Model> for DispatchListItemDto {
    fn from(m: erp_core::entities::dispatch::Model) -> Self {
        Self {
            id: m.id,
            invoice_number: m.invoice_number,
            customer_id: m.customer_id,
            dispatch_date: m.dispatch_date.to_string(),
            status: m.status,
            total_weight_kg: m.total_weight_kg,
        }
    }
}

#[derive(Serialize)]
struct PagedDispatches {
    items: Vec<DispatchListItemDto>,
    total: u64,
    page: u64,
    #[serde(rename = "pageSize")]
    page_size: u64,
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "customerId")]
    customer_id: Option<Uuid>,
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
struct DispatchItemRequest {
    #[serde(rename = "productId")]
    product_id: Uuid,
    quantity: f64,
    #[serde(rename = "weightKg")]
    weight_kg: Option<f64>,
}

#[derive(Deserialize)]
struct CreateDispatchRequest {
    #[serde(rename = "invoiceNumber")]
    invoice_number: String,
    #[serde(rename = "customerId")]
    customer_id: Uuid,
    #[serde(rename = "vehicleNumber")]
    vehicle_number: Option<String>,
    #[serde(rename = "driverName")]
    driver_name: Option<String>,
    #[serde(rename = "driverPhone")]
    driver_phone: Option<String>,
    #[serde(rename = "dispatchDate")]
    dispatch_date: NaiveDateTime,
    remarks: Option<String>,
    #[serde(default)]
    items: Vec<DispatchItemRequest>,
    #[serde(rename = "reelNumbers", default)]
    reel_numbers: Vec<String>,
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<PagedDispatches>> {
    let (rows, total) = dispatch_service::list(
        &state.db,
        dispatch_service::DispatchFilter {
            customer_id: query.customer_id,
            from: query.from,
            to: query.to,
        },
        query.page,
        query.page_size,
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(PagedDispatches {
        items: rows.into_iter().map(DispatchListItemDto::from).collect(),
        total,
        page: query.page,
        page_size: query.page_size,
    }))
}

async fn get_one(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<DispatchDto>> {
    let details = dispatch_service::get(&state.db, id).await.map_err(ApiError)?;
    Ok(Json(details.into()))
}

async fn create(
    State(state): State<AppState>,
    OperatorUser(user): OperatorUser,
    Json(body): Json<CreateDispatchRequest>,
) -> ApiResult<Json<DispatchDto>> {
    let created = dispatch_service::create(
        &state.db,
        dispatch_service::CreateDispatchInput {
            invoice_number: body.invoice_number,
            customer_id: body.customer_id,
            vehicle_number: body.vehicle_number,
            driver_name: body.driver_name,
            driver_phone: body.driver_phone,
            dispatch_date: body.dispatch_date,
            remarks: body.remarks,
            items: body
                .items
                .into_iter()
                .map(|i| dispatch_service::DispatchItemInput {
                    product_id: i.product_id,
                    quantity: i.quantity,
                    weight_kg: i.weight_kg,
                })
                .collect(),
            reel_numbers: body.reel_numbers,
        },
        user.user_id,
    )
    .await
    .map_err(ApiError)?;

    let details = dispatch_service::get(&state.db, created.id)
        .await
        .map_err(ApiError)?;

    Ok(Json(details.into()))
}
