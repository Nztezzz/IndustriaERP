//! Tauri commands invoked directly from the frontend via `invoke()`.
//!
//! Kept intentionally small: almost everything goes through the HTTP API
//! (`erp-server`) instead, since that's the single place RBAC/validation/
//! audit logging happen. Commands here are for the handful of things that
//! are inherently Tauri/OS-level concerns -- reading a one-time local file,
//! restarting the process -- rather than application data.

use crate::server;
use erp_core::auth::JwtService;
use erp_core::domain::Role;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Serialize)]
pub struct FirstRunCredentials {
    username: String,
    password: String,
}

/// Reads and immediately deletes the one-time admin credentials file
/// written on first launch (see `server::start`). Returns `None` on every
/// call after the first -- the frontend should call this once on app
/// startup and show the result in a modal if present.
#[tauri::command]
pub fn take_first_run_credentials(app: AppHandle) -> Option<FirstRunCredentials> {
    let path = server::resolve_db_path(&app)
        .parent()?
        .join("first_run_credentials.json");

    let contents = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);

    let value: serde_json::Value = serde_json::from_str(&contents).ok()?;
    Some(FirstRunCredentials {
        username: value.get("username")?.as_str()?.to_string(),
        password: value.get("password")?.as_str()?.to_string(),
    })
}

/// Restores the live database from a previously-created backup file, then
/// restarts the app so every part of the process (the Axum server's
/// connection pool included) reopens against the restored file cleanly.
///
/// This is deliberately a Tauri command rather than an HTTP route: closing
/// and reopening the live SQLite connection pool out from under itself
/// isn't something the Axum server can safely do to itself mid-request,
/// and a restart is unavoidable anyway.
///
/// Two safety checks before touching anything on disk:
/// 1. The caller's JWT is verified and must belong to an Admin -- restore
///    is destructive (it discards all data written since the backup) and
///    RBAC for it must not be weaker than the RBAC on the HTTP endpoint
///    that lists backups.
/// 2. `backup_file_path` must resolve to a path inside this app's own
///    backup directory, so a compromised/buggy frontend can't point this
///    at an arbitrary file on disk.
#[tauri::command]
pub fn restore_backup(app: AppHandle, token: String, backup_file_path: String) -> Result<(), String> {
    let db_path = server::resolve_db_path(&app);
    let data_dir = db_path
        .parent()
        .ok_or_else(|| "could not resolve app data directory".to_string())?;

    let jwt = JwtService::load_or_create(data_dir).map_err(|e| e.to_string())?;
    let user = jwt.verify_token(&token).map_err(|_| "invalid or expired session".to_string())?;
    if !user.role.has_min_role(Role::Admin) {
        return Err("only an admin can restore a backup".to_string());
    }

    let backup_dir = server::resolve_backup_dir(&app);
    let requested = std::path::PathBuf::from(&backup_file_path);

    let canonical_backup_dir = backup_dir
        .canonicalize()
        .map_err(|e| format!("backup directory is missing: {e}"))?;
    let canonical_requested = requested
        .canonicalize()
        .map_err(|e| format!("backup file not found: {e}"))?;

    if !canonical_requested.starts_with(&canonical_backup_dir) {
        return Err("backup file path is not inside the backups directory".to_string());
    }

    std::fs::copy(&canonical_requested, &db_path)
        .map_err(|e| format!("failed to restore backup: {e}"))?;

    // Stale WAL/SHM sidecars from the connection that was live before the
    // swap no longer correspond to the restored main file's contents;
    // leaving them would make SQLite try to replay mismatched frames on
    // next open.
    for suffix in ["-wal", "-shm"] {
        let sidecar = db_path.with_file_name(format!(
            "{}{}",
            db_path.file_name().unwrap_or_default().to_string_lossy(),
            suffix
        ));
        let _ = std::fs::remove_file(sidecar);
    }

    app.request_restart();
    Ok(())
}
