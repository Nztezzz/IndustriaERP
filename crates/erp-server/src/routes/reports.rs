use crate::error::{ApiError, ApiResult};
use crate::extractors::CurrentUser;
use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use chrono::NaiveDateTime;
use erp_core::services::report_service;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/reports/product-wise", get(product_wise))
        .route("/reports/customer-wise", get(customer_wise))
        .route("/reports/daily-activity", get(daily_activity))
        .route("/reports/pending-reels", get(pending_reels))
        .route("/reports/dispatches", get(dispatch_report))
        .route("/reports/ledger", get(ledger))
}

#[derive(Deserialize)]
struct RangeQuery {
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
}

impl RangeQuery {
    fn into_range(self) -> report_service::DateRange {
        report_service::DateRange {
            from: self.from,
            to: self.to,
        }
    }
}

#[derive(Serialize)]
struct ProductMovementSummaryDto {
    #[serde(rename = "productId")]
    product_id: Uuid,
    #[serde(rename = "productName")]
    product_name: String,
    #[serde(rename = "productSku")]
    product_sku: String,
    #[serde(rename = "totalInward")]
    total_inward: f64,
    #[serde(rename = "totalOutward")]
    total_outward: f64,
    #[serde(rename = "totalReturn")]
    total_return: f64,
    #[serde(rename = "totalAdjustmentDelta")]
    total_adjustment_delta: f64,
}

impl From<report_service::ProductMovementSummary> for ProductMovementSummaryDto {
    fn from(s: report_service::ProductMovementSummary) -> Self {
        Self {
            product_id: s.product_id,
            product_name: s.product_name,
            product_sku: s.product_sku,
            total_inward: s.total_inward,
            total_outward: s.total_outward,
            total_return: s.total_return,
            total_adjustment_delta: s.total_adjustment_delta,
        }
    }
}

#[derive(Serialize)]
struct CustomerDispatchSummaryDto {
    #[serde(rename = "customerId")]
    customer_id: Uuid,
    #[serde(rename = "customerName")]
    customer_name: String,
    #[serde(rename = "dispatchCount")]
    dispatch_count: u64,
    #[serde(rename = "totalWeightKg")]
    total_weight_kg: f64,
}

impl From<report_service::CustomerDispatchSummary> for CustomerDispatchSummaryDto {
    fn from(s: report_service::CustomerDispatchSummary) -> Self {
        Self {
            customer_id: s.customer_id,
            customer_name: s.customer_name,
            dispatch_count: s.dispatch_count,
            total_weight_kg: s.total_weight_kg,
        }
    }
}

#[derive(Serialize)]
struct DailyActivitySummaryDto {
    date: String,
    #[serde(rename = "inwardCount")]
    inward_count: u64,
    #[serde(rename = "outwardCount")]
    outward_count: u64,
    #[serde(rename = "returnCount")]
    return_count: u64,
    #[serde(rename = "dispatchCount")]
    dispatch_count: u64,
}

impl From<report_service::DailyActivitySummary> for DailyActivitySummaryDto {
    fn from(s: report_service::DailyActivitySummary) -> Self {
        Self {
            date: s.date,
            inward_count: s.inward_count,
            outward_count: s.outward_count,
            return_count: s.return_count,
            dispatch_count: s.dispatch_count,
        }
    }
}

#[derive(Serialize)]
struct PendingReelReportRowDto {
    #[serde(rename = "reelNumber")]
    reel_number: String,
    #[serde(rename = "productName")]
    product_name: String,
    #[serde(rename = "customerName")]
    customer_name: Option<String>,
    status: String,
    since: String,
}

impl From<report_service::PendingReelReportRow> for PendingReelReportRowDto {
    fn from(r: report_service::PendingReelReportRow) -> Self {
        Self {
            reel_number: r.reel_number,
            product_name: r.product_name,
            customer_name: r.customer_name,
            status: r.status,
            since: r.since.to_string(),
        }
    }
}

#[derive(Serialize)]
struct DispatchReportRowDto {
    #[serde(rename = "invoiceNumber")]
    invoice_number: String,
    #[serde(rename = "customerName")]
    customer_name: String,
    #[serde(rename = "dispatchDate")]
    dispatch_date: String,
    status: String,
    #[serde(rename = "totalWeightKg")]
    total_weight_kg: Option<f64>,
}

impl From<report_service::DispatchReportRow> for DispatchReportRowDto {
    fn from(r: report_service::DispatchReportRow) -> Self {
        Self {
            invoice_number: r.invoice_number,
            customer_name: r.customer_name,
            dispatch_date: r.dispatch_date.to_string(),
            status: r.status,
            total_weight_kg: r.total_weight_kg,
        }
    }
}

async fn product_wise(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    axum::extract::Query(query): axum::extract::Query<RangeQuery>,
) -> ApiResult<Json<Vec<ProductMovementSummaryDto>>> {
    let rows = report_service::product_wise_summary(&state.db, query.into_range())
        .await
        .map_err(ApiError)?;
    Ok(Json(rows.into_iter().map(ProductMovementSummaryDto::from).collect()))
}

async fn customer_wise(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    axum::extract::Query(query): axum::extract::Query<RangeQuery>,
) -> ApiResult<Json<Vec<CustomerDispatchSummaryDto>>> {
    let rows = report_service::customer_wise_summary(&state.db, query.into_range())
        .await
        .map_err(ApiError)?;
    Ok(Json(rows.into_iter().map(CustomerDispatchSummaryDto::from).collect()))
}

async fn daily_activity(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    axum::extract::Query(query): axum::extract::Query<RangeQuery>,
) -> ApiResult<Json<Vec<DailyActivitySummaryDto>>> {
    let rows = report_service::daily_activity(&state.db, query.into_range())
        .await
        .map_err(ApiError)?;
    Ok(Json(rows.into_iter().map(DailyActivitySummaryDto::from).collect()))
}

async fn pending_reels(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
) -> ApiResult<Json<Vec<PendingReelReportRowDto>>> {
    let rows = report_service::pending_reels(&state.db).await.map_err(ApiError)?;
    Ok(Json(rows.into_iter().map(PendingReelReportRowDto::from).collect()))
}

async fn dispatch_report(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    axum::extract::Query(query): axum::extract::Query<RangeQuery>,
) -> ApiResult<Json<Vec<DispatchReportRowDto>>> {
    let rows = report_service::dispatch_report(&state.db, query.into_range())
        .await
        .map_err(ApiError)?;
    Ok(Json(rows.into_iter().map(DispatchReportRowDto::from).collect()))
}

#[derive(Deserialize)]
struct LedgerQuery {
    from: Option<NaiveDateTime>,
    to: Option<NaiveDateTime>,
    #[serde(rename = "customerId")]
    customer_id: Option<Uuid>,
}

#[derive(Serialize)]
struct LedgerEntryDto {
    id: Uuid,
    date: String,
    #[serde(rename = "customerName")]
    customer_name: Option<String>,
    #[serde(rename = "productId")]
    product_id: Uuid,
    #[serde(rename = "productName")]
    product_name: String,
    #[serde(rename = "productSku")]
    product_sku: String,
    #[serde(rename = "movementType")]
    movement_type: String,
    quantity: f64,
    #[serde(rename = "referenceNumber")]
    reference_number: Option<String>,
    remarks: Option<String>,
}

impl From<report_service::LedgerEntry> for LedgerEntryDto {
    fn from(e: report_service::LedgerEntry) -> Self {
        Self {
            id: e.id,
            date: e.date.to_string(),
            customer_name: e.customer_name,
            product_id: e.product_id,
            product_name: e.product_name,
            product_sku: e.product_sku,
            movement_type: e.movement_type,
            quantity: e.quantity,
            reference_number: e.reference_number,
            remarks: e.remarks,
        }
    }
}

/// Row-level ledger: every stock movement in the date range with its
/// customer/party name resolved, for reports that need individual entries
/// rather than the aggregated totals `product-wise` returns.
async fn ledger(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    axum::extract::Query(query): axum::extract::Query<LedgerQuery>,
) -> ApiResult<Json<Vec<LedgerEntryDto>>> {
    let rows = report_service::ledger_entries(
        &state.db,
        report_service::DateRange {
            from: query.from,
            to: query.to,
        },
        query.customer_id,
    )
    .await
    .map_err(ApiError)?;
    Ok(Json(rows.into_iter().map(LedgerEntryDto::from).collect()))
}
