use crate::error::{ApiError, ApiResult};
use crate::extractors::CurrentUser;
use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use erp_core::services::search_service;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new().route("/search", get(search))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

#[derive(Serialize)]
struct ProductHit {
    id: Uuid,
    sku: String,
    name: String,
}

#[derive(Serialize)]
struct CustomerHit {
    id: Uuid,
    name: String,
    phone: Option<String>,
}

#[derive(Serialize)]
struct ReelHit {
    id: Uuid,
    #[serde(rename = "reelNumber")]
    reel_number: String,
    status: String,
}

#[derive(Serialize)]
struct DispatchHit {
    id: Uuid,
    #[serde(rename = "invoiceNumber")]
    invoice_number: String,
}

#[derive(Serialize)]
struct SearchResultsDto {
    products: Vec<ProductHit>,
    customers: Vec<CustomerHit>,
    reels: Vec<ReelHit>,
    dispatches: Vec<DispatchHit>,
}

async fn search(
    State(state): State<AppState>,
    CurrentUser(_): CurrentUser,
    axum::extract::Query(query): axum::extract::Query<SearchQuery>,
) -> ApiResult<Json<SearchResultsDto>> {
    let results = search_service::search(&state.db, &query.q)
        .await
        .map_err(ApiError)?;

    Ok(Json(SearchResultsDto {
        products: results
            .products
            .into_iter()
            .map(|p| ProductHit {
                id: p.id,
                sku: p.sku,
                name: p.name,
            })
            .collect(),
        customers: results
            .customers
            .into_iter()
            .map(|c| CustomerHit {
                id: c.id,
                name: c.name,
                phone: c.phone,
            })
            .collect(),
        reels: results
            .reels
            .into_iter()
            .map(|r| ReelHit {
                id: r.id,
                reel_number: r.reel_number,
                status: r.status,
            })
            .collect(),
        dispatches: results
            .dispatches
            .into_iter()
            .map(|d| DispatchHit {
                id: d.id,
                invoice_number: d.invoice_number,
            })
            .collect(),
    }))
}
