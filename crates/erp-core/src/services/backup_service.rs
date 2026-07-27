use crate::domain::BackupTrigger;
use crate::entities::backup;
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryOrder, Set};
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Copies the live SQLite file to `backup_dir/preyansh-erp-<timestamp>.db`
/// and records the backup in the `backups` table.
///
/// SQLite is a single file (plus `-wal`/`-shm` sidecars while WAL mode has
/// uncommitted frames), so "backup" here means: force a WAL checkpoint so
/// everything is flushed into the main file, then copy that one file. This
/// is simpler and more robust than trying to zip a live, possibly-open
/// database -- restoring is just copying a file back into place.
pub async fn create_backup(
    db: &DatabaseConnection,
    db_path: &Path,
    backup_dir: &Path,
    trigger: BackupTrigger,
    created_by: Option<Uuid>,
) -> AppResult<backup::Model> {
    std::fs::create_dir_all(backup_dir)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to create backup directory: {e}")))?;

    // Flush WAL frames into the main DB file so the copy below is complete
    // and self-contained (no separate -wal file needed to restore it).
    db.execute_unprepared("PRAGMA wal_checkpoint(TRUNCATE);")
        .await?;

    let timestamp = Utc::now().format("%Y%m%d-%H%M%S");
    let file_name = format!("preyansh-erp-{timestamp}.db");
    let dest_path = backup_dir.join(&file_name);

    std::fs::copy(db_path, &dest_path)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to copy database file: {e}")))?;

    let file_size_bytes = std::fs::metadata(&dest_path)
        .map(|m| m.len() as i64)
        .unwrap_or(0);

    let record = backup::ActiveModel {
        id: Set(Uuid::new_v4()),
        file_path: Set(dest_path.to_string_lossy().to_string()),
        file_size_bytes: Set(file_size_bytes),
        trigger_type: Set(trigger.as_str().to_string()),
        created_by: Set(created_by),
        created_at: Set(Utc::now().naive_utc()),
    };

    Ok(record.insert(db).await?)
}

pub async fn list_backups(db: &DatabaseConnection) -> AppResult<Vec<backup::Model>> {
    Ok(backup::Entity::find()
        .order_by_desc(backup::Column::CreatedAt)
        .all(db)
        .await?)
}

/// Validates that `backup_id` refers to a backup file that still exists on
/// disk and returns its path, so the Tauri layer can perform the actual
/// restore (which requires closing/reopening the live DB connection --
/// something this crate's plain-connection API can't do to itself).
pub async fn resolve_restore_path(db: &DatabaseConnection, backup_id: Uuid) -> AppResult<PathBuf> {
    let record = backup::Entity::find_by_id(backup_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("backup {backup_id} not found")))?;

    let path = PathBuf::from(&record.file_path);
    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "backup file is missing on disk: {}",
            record.file_path
        )));
    }

    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn create_backup_copies_file_and_records_it() {
        let dir = std::env::temp_dir().join(format!("erp-backup-test-{}", Uuid::new_v4()));
        let db_path = dir.join("test.db");
        let backup_dir = dir.join("backups");
        let conn = db::init(&db_path).await.unwrap();

        let record = create_backup(&conn, &db_path, &backup_dir, BackupTrigger::Manual, None)
            .await
            .unwrap();

        assert!(PathBuf::from(&record.file_path).exists());
        assert!(record.file_size_bytes > 0);

        let backups = list_backups(&conn).await.unwrap();
        assert_eq!(backups.len(), 1);

        let resolved = resolve_restore_path(&conn, record.id).await.unwrap();
        assert_eq!(resolved, PathBuf::from(&record.file_path));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
