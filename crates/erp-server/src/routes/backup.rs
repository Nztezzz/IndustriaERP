use crate::error::{ApiError, ApiResult};
use crate::extractors::AdminUser;
use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use erp_core::domain::BackupTrigger;
use erp_core::services::backup_service;
use serde::Serialize;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new().route("/backup", get(list).post(create))
}

#[derive(Serialize)]
struct BackupDto {
    id: Uuid,
    #[serde(rename = "filePath")]
    file_path: String,
    #[serde(rename = "fileSizeBytes")]
    file_size_bytes: i64,
    #[serde(rename = "triggerType")]
    trigger_type: String,
    #[serde(rename = "createdAt")]
    created_at: String,
}

impl From<erp_core::entities::backup::Model> for BackupDto {
    fn from(m: erp_core::entities::backup::Model) -> Self {
        Self {
            id: m.id,
            file_path: m.file_path,
            file_size_bytes: m.file_size_bytes,
            trigger_type: m.trigger_type,
            created_at: m.created_at.to_string(),
        }
    }
}

/// Admin-only: both browsing backup history and triggering a new manual
/// backup. Restoring a backup is intentionally NOT exposed here -- it
/// requires swapping the live database file out from under the running
/// connection pool and restarting the app, which is a Tauri-level command
/// (`restore_backup` in `src-tauri/src/commands.rs`), not an HTTP action.
async fn list(State(state): State<AppState>, AdminUser(_): AdminUser) -> ApiResult<Json<Vec<BackupDto>>> {
    let backups = backup_service::list_backups(&state.db).await.map_err(ApiError)?;
    Ok(Json(backups.into_iter().map(BackupDto::from).collect()))
}

async fn create(
    State(state): State<AppState>,
    AdminUser(user): AdminUser,
) -> ApiResult<Json<BackupDto>> {
    let backup = backup_service::create_backup(
        &state.db,
        &state.db_path,
        &state.backup_dir,
        BackupTrigger::Manual,
        Some(user.user_id),
    )
    .await
    .map_err(ApiError)?;

    Ok(Json(backup.into()))
}
