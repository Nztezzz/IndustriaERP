//! First-run data seeding.
//!
//! Seeds only the base "Piece" unit on first run so that when the user
//! creates their own products they have a unit available. No sample/demo
//! products are created — the user adds their own catalogue via the
//! Products page.

use crate::entities::unit;
use crate::error::AppResult;
use crate::services::unit_service;
use sea_orm::{DatabaseConnection, EntityTrait, PaginatorTrait};

const DEFAULT_UNIT_NAME: &str = "Piece";
const DEFAULT_UNIT_SYMBOL: &str = "pc";

/// Seeds only the base unit ("Piece") into an empty database.
/// Returns 1 if the unit was created, 0 if it already existed.
pub async fn ensure_default_products(db: &DatabaseConnection) -> AppResult<usize> {
    // If there's already a unit, we've already run or the user has set things up.
    let existing_units = unit::Entity::find().count(db).await?;
    if existing_units > 0 {
        return Ok(0);
    }

    unit_service::create(
        db,
        unit_service::CreateUnitInput {
            name: DEFAULT_UNIT_NAME.to_string(),
            symbol: DEFAULT_UNIT_SYMBOL.to_string(),
            conversion_factor: 1.0,
        },
    )
    .await?;

    Ok(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use sea_orm::DatabaseConnection;
    use uuid::Uuid;

    async fn fresh_db() -> (DatabaseConnection, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!("erp-seed-test-{}", Uuid::new_v4()));
        let conn = db::init(&dir.join("test.db")).await.unwrap();
        (conn, dir)
    }

    #[tokio::test]
    async fn seeds_default_unit_into_empty_database() {
        let (conn, dir) = fresh_db().await;

        let created = ensure_default_products(&conn).await.unwrap();
        assert_eq!(created, 1);

        let units = unit_service::list(&conn).await.unwrap();
        assert_eq!(units.len(), 1);
        assert_eq!(units[0].name, DEFAULT_UNIT_NAME);
        assert_eq!(units[0].symbol, DEFAULT_UNIT_SYMBOL);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn is_idempotent_across_repeated_runs() {
        let (conn, dir) = fresh_db().await;

        let first = ensure_default_products(&conn).await.unwrap();
        let second = ensure_default_products(&conn).await.unwrap();

        assert_eq!(first, 1);
        assert_eq!(second, 0, "second run must be a no-op");

        let _ = std::fs::remove_dir_all(dir);
    }
}
