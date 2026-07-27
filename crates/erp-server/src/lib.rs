//! Axum HTTP API for Preyansh ERP.
//!
//! This crate is intentionally a thin transport layer: routing, request
//! parsing, and HTTP-shaped error responses. All business logic lives in
//! `erp-core`'s services. The Tauri shell (`src-tauri`) owns the server's
//! lifecycle -- binding the listener, choosing the port, and shutting it
//! down when the app closes -- via `serve()` below.

pub mod error;
pub mod extractors;
pub mod routes;
pub mod state;

use state::AppState;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Binds to `127.0.0.1:<port>` and serves until the returned future is
/// dropped/cancelled. Bound to loopback only -- this server is never meant
/// to be reachable from outside the local machine; the "multi-computer"
/// story in the project plan is a separate, explicitly-opted-into sync
/// server, not this API listening on the network.
pub async fn serve(state: AppState, port: u16) -> std::io::Result<()> {
    let app = routes::build_router(state)
        .layer(TraceLayer::new_for_http())
        // CORS is permissive because the only caller is the Tauri webview
        // on the same machine (effectively a different origin than a
        // plain http:// URL due to the tauri:// scheme), never a remote
        // browser. Tightening this further would break the webview for no
        // real security gain since the port isn't reachable externally.
        .layer(CorsLayer::permissive());

    let listener = TcpListener::bind(("127.0.0.1", port)).await?;
    tracing::info!(port, "erp-server listening");

    axum::serve(listener, app).await
}
