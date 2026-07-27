//! Owns the lifecycle of the embedded Axum server: resolving where the
//! SQLite file lives, running migrations, and starting the HTTP listener
//! that the React frontend talks to over `127.0.0.1`.
//!
//! Deliberately kept as "just wiring" -- no business logic here, that all
//! lives in `erp-core` and `erp-server`. This module exists so `lib.rs`'s
//! `run()` stays readable.

use erp_server::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Fixed loopback port the embedded server listens on. Must match
/// `API_PORT` in the frontend's `src/lib/api/config.ts` -- there is no
/// runtime negotiation between the two by design, since this server is
/// never meant to be reachable from anywhere but this app's own webview.
pub const API_PORT: u16 = 47932;

/// Resolves `<app-data-dir>/preyansh-erp.db`, creating the app data
/// directory if it doesn't exist yet. Using Tauri's resolver (rather than a
/// hardcoded relative path) is what makes this behave correctly both in
/// `tauri dev` and in an installed build, and on every OS Tauri supports.
pub fn resolve_db_path(app: &AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .expect("app_data_dir should always resolve on desktop platforms");
    data_dir.join("preyansh-erp.db")
}

/// Connects to SQLite (running migrations if needed) and starts the Axum
/// server in the background. Called once from the `setup` hook; errors are
/// fatal on startup since the frontend has nothing to talk to otherwise.
pub async fn start(app: AppHandle) -> anyhow::Result<()> {
    let db_path = resolve_db_path(&app);
    let data_dir = db_path
        .parent()
        .expect("db_path always has a parent (the app data dir)")
        .to_path_buf();
    tracing::info!(path = %db_path.display(), "opening database");

    let db = erp_core::db::init(&db_path).await?;
    let jwt = erp_core::auth::JwtService::load_or_create(&data_dir)?;

    if let Some((username, password)) = erp_core::services::auth_service::ensure_default_admin(&db).await? {
        // Fresh install: write the generated credential to a one-time file
        // the frontend reads (and deletes) via the `take_first_run_credentials`
        // Tauri command to show in a "your admin account was created" modal.
        // A log line would be useless here -- the target user is a stock
        // clerk, not someone tailing logs -- and we still don't persist the
        // plaintext password anywhere beyond this single hand-off file.
        let payload = serde_json::json!({ "username": username, "password": password });
        if let Err(err) = std::fs::write(
            data_dir.join("first_run_credentials.json"),
            payload.to_string(),
        ) {
            tracing::error!(error = %err, "failed to write first-run credentials file");
        }
    }

    let backup_dir = data_dir.join("backups");
    let state = AppState::new(db, jwt, db_path, backup_dir);

    // Runs forever (until the process exits); spawned so `start` itself
    // returns promptly and `setup` doesn't block the rest of app startup.
    tauri::async_runtime::spawn(async move {
        if let Err(err) = erp_server::serve(state, API_PORT).await {
            tracing::error!(error = %err, "erp-server exited unexpectedly");
        }
    });

    Ok(())
}

/// Resolves where scheduled/manual backups are written --
/// `<app-data-dir>/backups/`. Exposed separately from `start()` so
/// `commands::restore_backup` can validate a restore target lives in this
/// directory without needing to re-derive it.
pub fn resolve_backup_dir(app: &AppHandle) -> PathBuf {
    resolve_db_path(app)
        .parent()
        .expect("db_path always has a parent")
        .join("backups")
}
