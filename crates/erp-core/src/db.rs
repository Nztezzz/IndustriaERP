use erp_migration::{Migrator, MigratorTrait};
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DatabaseConnection, DbErr};
use std::path::Path;
use std::time::Duration;

/// Opens the SQLite database at `db_path` (creating the file and any parent
/// directories if missing) and runs every pending migration.
///
/// This is the single entry point both `erp-server` (via the Tauri shell)
/// and the standalone `erp-migrate` CLI's programmatic callers should use --
/// keeping schema setup in one place is what lets us later point the same
/// call at a Postgres URL for the sync server without touching callers.
pub async fn init(db_path: &Path) -> Result<DatabaseConnection, DbErr> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| DbErr::Custom(e.to_string()))?;
    }

    // `mode=rwc` creates the file if it doesn't exist yet (fresh install).
    let url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let mut opts = ConnectOptions::new(url);
    opts.max_connections(8)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(8))
        .sqlx_logging(false);

    let conn = Database::connect(opts).await?;

    // SQLite-specific pragmas for a desktop app writing from a single
    // process: WAL gives readers concurrent access while a write is in
    // flight, and foreign_keys must be turned on per-connection (SQLite
    // ships with it off by default) or every FK constraint in the
    // migrations is silently unenforced.
    conn.execute_unprepared("PRAGMA journal_mode = WAL;").await?;
    conn.execute_unprepared("PRAGMA foreign_keys = ON;").await?;
    conn.execute_unprepared("PRAGMA busy_timeout = 5000;").await?;

    Migrator::up(&conn, None).await?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn init_creates_db_and_runs_migrations() {
        let dir = std::env::temp_dir().join(format!("erp-core-test-{}", uuid::Uuid::new_v4()));
        let db_path = dir.join("test.db");

        let conn = init(&db_path).await.expect("init should succeed");
        assert!(db_path.exists());

        // Re-running init against the same file should be idempotent (no
        // pending migrations left, no error).
        drop(conn);
        let conn2 = init(&db_path).await.expect("second init should succeed");
        drop(conn2);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
