use crate::error::{ApiError, ApiResult};
use crate::extractors::{CurrentUser, OperatorUser};
use crate::state::AppState;
use axum::{
    extract::{Path, State},
    routing::{get, put},
    Json, Router,
};
use erp_core::services::unit_service;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/units", get(list).post(create))
        .route("/units/{id}", put(update).delete(remove))
}

#[derive(Serialize)]
struct UnitDto {
    id: Uuid,
    name: String,
    symbol: String,
    #[serde(rename = "conversionFactor")]
    conversion_factor: f32,
}

impl From<erp_core::entities::unit::Model> for UnitDto {
    fn from(m: erp_core::entities::unit::Model) -> Self {
        Self {
            id: m.id,
            name: m.name,
            symbol: m.symbol,
            conversion_factor: m.conversion_factor,
        }
    }
}

#[derive(Deserialize)]
struct UnitRequest {
    name: String,
    symbol: String,
    #[serde(rename = "conversionFactor")]
    conversion_factor: f32,
}

async fn list(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> ApiResult<Json<Vec<UnitDto>>> {
    let units = unit_service::list(&state.db).await.map_err(ApiError)?;
    Ok(Json(units.into_iter().map(UnitDto::from).collect()))
}

async fn create(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Json(body): Json<UnitRequest>,
) -> ApiResult<Json<UnitDto>> {
    let created = unit_service::create(
        &state.db,
        unit_service::CreateUnitInput {
            name: body.name,
            symbol: body.symbol,
            conversion_factor: body.conversion_factor,
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
    Json(body): Json<UnitRequest>,
) -> ApiResult<Json<UnitDto>> {
    let updated = unit_service::update(
        &state.db,
        id,
        unit_service::UpdateUnitInput {
            name: body.name,
            symbol: body.symbol,
            conversion_factor: body.conversion_factor,
        },
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(updated.into()))
}

async fn remove(
    State(state): State<AppState>,
    OperatorUser(_): OperatorUser,
    Path(id): Path<Uuid>,
) -> ApiResult<axum::http::StatusCode> {
    unit_service::delete(&state.db, id).await.map_err(ApiError)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
