use erp_core::auth::JwtService;
use sea_orm::DatabaseConnection;
use std::path::PathBuf;
use std::sync::Arc;

/// Shared state handed to every Axum handler via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DatabaseConnection>,
    pub jwt: JwtService,
    /// Path to the live SQLite file -- needed by the backup routes to know
    /// what to copy. Restore is deliberately NOT handled here: swapping
    /// the live file out from under an open connection pool and
    /// restarting the app is an OS-process-level concern, so that flow
    /// lives in a Tauri command instead (see `src-tauri/src/commands.rs`).
    pub db_path: PathBuf,
    pub backup_dir: PathBuf,
}

impl AppState {
    pub fn new(db: DatabaseConnection, jwt: JwtService, db_path: PathBuf, backup_dir: PathBuf) -> Self {
        Self {
            db: Arc::new(db),
            jwt,
            db_path,
            backup_dir,
        }
    }
}
