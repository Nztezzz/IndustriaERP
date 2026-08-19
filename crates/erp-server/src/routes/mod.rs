mod audit_log;
mod auth;
mod backup;
mod customers;
mod dashboard;
mod dispatches;
mod health;
mod packing_slips;
mod products;
mod reels;
mod reports;
mod returns;
mod search;
mod stock;
mod units;

use crate::state::AppState;
use axum::Router;

/// Builds the full `/api/*` router by merging every module's sub-router.
/// Each module owns its own DTOs and RBAC gating (via the `CurrentUser` /
/// `OperatorUser` / `AdminUser` extractors) -- this function is just
/// composition.
pub fn build_router(state: AppState) -> Router {
    let api = health::router()
        .merge(auth::router())
        .merge(units::router())
        .merge(products::router())
        .merge(customers::router())
        .merge(stock::router())
        .merge(dispatches::router())
        .merge(reels::router())
        .merge(dashboard::router())
        .merge(search::router())
        .merge(reports::router())
        .merge(audit_log::router())
        .merge(backup::router())
        .merge(packing_slips::router())
        .merge(returns::router());

    Router::new().nest("/api", api).with_state(state)
}
