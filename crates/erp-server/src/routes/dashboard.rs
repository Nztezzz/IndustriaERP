use crate::error::{ApiError, ApiResult};
use crate::extractors::CurrentUser;
use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use erp_core::services::dashboard_service;
use serde::Serialize;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/dashboard/summary", get(summary))
        .route("/dashboard/activity", get(activity))
}

#[derive(Serialize)]
struct DashboardSummaryDto {
    #[serde(rename = "totalProducts")]
    total_products: u64,
    #[serde(rename = "lowStockProductCount")]
    low_stock_product_count: u64,
    #[serde(rename = "todayInwardCount")]
    today_inward_count: u64,
    #[serde(rename = "todayOutwardCount")]
    today_outward_count: u64,
    #[serde(rename = "todayDispatchCount")]
    today_dispatch_count: u64,
    #[serde(rename = "pendingReelCount")]
    pending_reel_count: u64,
}

impl From<dashboard_service::DashboardSummary> for DashboardSummaryDto {
    fn from(s: dashboard_service::DashboardSummary) -> Self {
        Self {
            total_products: s.total_products,
            low_stock_product_count: s.low_stock_product_count,
            today_inward_count: s.today_inward_count,
            today_outward_count: s.today_outward_count,
            today_dispatch_count: s.today_dispatch_count,
            pending_reel_count: s.pending_reel_count,
        }
    }
}

#[derive(Serialize)]
struct ActivityEntryDto {
    kind: String,
    description: String,
    timestamp: String,
}

impl From<dashboard_service::ActivityEntry> for ActivityEntryDto {
    fn from(e: dashboard_service::ActivityEntry) -> Self {
        Self {
            kind: e.kind,
            description: e.description,
            timestamp: e.timestamp.to_string(),
        }
    }
}

async fn summary(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> ApiResult<Json<DashboardSummaryDto>> {
    let summary = dashboard_service::summary(&state.db).await.map_err(ApiError)?;
    Ok(Json(summary.into()))
}

async fn activity(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> ApiResult<Json<Vec<ActivityEntryDto>>> {
    let entries = dashboard_service::recent_activity(&state.db, 20)
        .await
        .map_err(ApiError)?;
    Ok(Json(entries.into_iter().map(ActivityEntryDto::from).collect()))
}
