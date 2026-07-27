use crate::error::{ApiError, ApiResult};
use crate::extractors::{CurrentUser, OperatorUser};
use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use erp_core::services::product_service;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/products", get(list).post(create))
        .route("/products/{id}", get(get_one).put(update))
        .route("/products/{id}/deactivate", post(deactivate))
}

#[derive(Serialize)]
struct ProductDto {
    id: Uuid,
    sku: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "baseUnitId")]
    base_unit_id: Uuid,
    #[serde(rename = "baseUnitSymbol")]
    base_unit_symbol: Option<String>,
    specifications: Option<JsonValue>,
    #[serde(rename = "reorderLevel")]
    reorder_level: f64,
    #[serde(rename = "isActive")]
    is_active: bool,
}

impl From<erp_core::entities::product::Model> for ProductDto {
    fn from(m: erp_core::entities::product::Model) -> Self {
        Self {
            id: m.id,
            sku: m.sku,
            name: m.name,
            description: m.description,
            base_unit_id: m.base_unit_id,
            base_unit_symbol: None,
            specifications: m.specifications,
            reorder_level: m.reorder_level,
            is_active: m.is_active,
        }
    }
}

impl From<product_service::ProductWithUnit> for ProductDto {
    fn from(pu: product_service::ProductWithUnit) -> Self {
        let mut dto: ProductDto = pu.product.into();
        dto.base_unit_symbol = Some(pu.unit_symbol);
        dto
    }
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "includeInactive", default)]
    include_inactive: bool,
}

#[derive(Deserialize)]
struct ProductRequest {
    sku: String,
    name: String,
    description: Option<String>,
    #[serde(rename = "baseUnitId")]
    base_unit_id: Uuid,
    specifications: Option<JsonValue>,
    #[serde(rename = "reorderLevel")]
    reorder_level: f64,
    #[serde(rename = "isActive", default = "default_true")]
    is_active: bool,
}

fn default_true() -> bool {
    true
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Query(query): Query<ListQuery>,
) -> ApiResult<Json<Vec<ProductDto>>> {
    let products = product_service::list(&state.db, query.include_inactive)
        .await
        .map_err(ApiError)?;
    Ok(Json(products.into_iter().map(ProductDto::from).collect()))
}

async fn get_one(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<ProductDto>> {
    let product = product_service::get(&state.db, id).await.map_err(ApiError)?;
    Ok(Json(product.into()))
}

async fn create(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Json(body): Json<ProductRequest>,
) -> ApiResult<Json<ProductDto>> {
    let created = product_service::create(
        &state.db,
        product_service::CreateProductInput {
            sku: body.sku,
            name: body.name,
            description: body.description,
            base_unit_id: body.base_unit_id,
            specifications: body.specifications,
            reorder_level: body.reorder_level,
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
    Json(body): Json<ProductRequest>,
) -> ApiResult<Json<ProductDto>> {
    let updated = product_service::update(
        &state.db,
        id,
        product_service::UpdateProductInput {
            sku: body.sku,
            name: body.name,
            description: body.description,
            base_unit_id: body.base_unit_id,
            specifications: body.specifications,
            reorder_level: body.reorder_level,
            is_active: body.is_active,
        },
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(updated.into()))
}

async fn deactivate(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<ProductDto>> {
    let product = product_service::deactivate(&state.db, id)
        .await
        .map_err(ApiError)?;
    Ok(Json(product.into()))
}
