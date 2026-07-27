use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
    database: &'static str,
}

/// Used by the Tauri shell on startup to confirm the embedded server is
/// actually accepting connections before the frontend starts issuing
/// requests, and by the Backup & Restore page to sanity-check DB
/// connectivity before attempting a backup.
pub fn router() -> Router<AppState> {
    Router::new().route("/health", get(health))
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    let database = match state.db.ping().await {
        Ok(()) => "connected",
        Err(_) => "unreachable",
    };

    Json(HealthResponse {
        status: "ok",
        database,
    })
}
