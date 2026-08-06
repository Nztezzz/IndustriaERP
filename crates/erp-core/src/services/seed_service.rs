//! First-run data seeding.
//!
//! Without this, a freshly installed copy of the app opens with an empty
//! database: the only row anywhere is the auto-generated admin user. That
//! makes the app effectively unusable out of the box -- Inward Entry,
//! Outward Entry, Adjustments and Packing Slip all require a product to be
//! selected, and their dropdowns would be empty with no obvious way forward.
//!
//! So on first run we seed the standard Preyansh product set (the base
//! "Piece" unit plus the five reel/spool types). This runs on every startup
//! but is idempotent: it no-ops the moment any product already exists, so
//! it never fights with a user who has since renamed, deactivated, or
//! replaced the defaults.

use crate::entities::{product, unit};
use crate::error::AppResult;
use crate::services::{product_service, unit_service};
use sea_orm::{DatabaseConnection, EntityTrait, PaginatorTrait};

/// The product set this business actually runs on. `sku` is what shows in
/// reports/exports; `name` is what operators pick from dropdowns.
const DEFAULT_PRODUCTS: &[(&str, &str)] = &[
    ("REEL-PL", "Plastic Reel"),
    ("SPOOL-300", "300 mm Spool"),
    ("SPOOL-500", "500 mm Spool"),
    ("SPOOL-630", "630 mm Spool"),
    ("SPOOL-800", "800 mm Spool"),
];

const DEFAULT_UNIT_NAME: &str = "Piece";
const DEFAULT_UNIT_SYMBOL: &str = "pc";

/// Seeds the default unit + product set, but only into a database that has
/// no products at all. Returns the number of products created (0 when this
/// was a no-op) so the caller can log something meaningful.
pub async fn ensure_default_products(db: &DatabaseConnection) -> AppResult<usize> {
    // Idempotency guard: ANY existing product (active or not) means this
    // database has already been set up or curated by a real user, and we
    // must not re-add rows they may have deliberately removed.
    let existing_products = product::Entity::find().count(db).await?;
    if existing_products > 0 {
        return Ok(0);
    }

    // Reuse an existing "Piece" unit if one happens to be there already
    // (e.g. the user created units before adding any products), otherwise
    // create it. Products can't exist without a base unit FK.
    let unit_id = match find_unit_by_name(db, DEFAULT_UNIT_NAME).await? {
        Some(existing) => existing.id,
        None => {
            unit_service::create(
                db,
                unit_service::CreateUnitInput {
                    name: DEFAULT_UNIT_NAME.to_string(),
                    symbol: DEFAULT_UNIT_SYMBOL.to_string(),
                    conversion_factor: 1.0,
                },
            )
            .await?
            .id
        }
    };

    let mut created = 0usize;
    for (sku, name) in DEFAULT_PRODUCTS {
        product_service::create(
            db,
            product_service::CreateProductInput {
                sku: (*sku).to_string(),
                name: (*name).to_string(),
                description: None,
                base_unit_id: unit_id,
                specifications: None,
                reorder_level: 0.0,
            },
        )
        .await?;
        created += 1;
    }

    Ok(created)
}

async fn find_unit_by_name(
    db: &DatabaseConnection,
    name: &str,
) -> AppResult<Option<unit::Model>> {
    use sea_orm::{ColumnTrait, QueryFilter};

    Ok(unit::Entity::find()
        .filter(unit::Column::Name.eq(name))
        .one(db)
        .await?)
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

    /// The whole point of this module: a brand-new database must come out of
    /// seeding with the five sellable products present and selectable.
    #[tokio::test]
    async fn seeds_default_products_into_empty_database() {
        let (conn, dir) = fresh_db().await;

        let created = ensure_default_products(&conn).await.unwrap();
        assert_eq!(created, DEFAULT_PRODUCTS.len());

        let products = product_service::list(&conn, false).await.unwrap();
        assert_eq!(products.len(), DEFAULT_PRODUCTS.len());

        // Names are what operators actually pick from the dropdowns.
        let mut names: Vec<_> = products.iter().map(|p| p.product.name.clone()).collect();
        names.sort();
        assert_eq!(
            names,
            vec![
                "300 mm Spool",
                "500 mm Spool",
                "630 mm Spool",
                "800 mm Spool",
                "Plastic Reel",
            ]
        );

        // Every product must resolve a base unit, otherwise quantity fields
        // render without a unit symbol.
        assert!(products.iter().all(|p| p.unit_symbol == DEFAULT_UNIT_SYMBOL));

        let _ = std::fs::remove_dir_all(dir);
    }

    /// Runs on every startup, so it must not duplicate rows or resurrect
    /// products the user has intentionally curated away.
    #[tokio::test]
    async fn is_idempotent_across_repeated_runs() {
        let (conn, dir) = fresh_db().await;

        let first = ensure_default_products(&conn).await.unwrap();
        let second = ensure_default_products(&conn).await.unwrap();
        let third = ensure_default_products(&conn).await.unwrap();

        assert_eq!(first, DEFAULT_PRODUCTS.len());
        assert_eq!(second, 0, "second run must be a no-op");
        assert_eq!(third, 0, "third run must be a no-op");

        let products = product_service::list(&conn, true).await.unwrap();
        assert_eq!(
            products.len(),
            DEFAULT_PRODUCTS.len(),
            "repeated seeding must not duplicate products"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    /// If the user has already built their own catalogue, seeding must stay
    /// out of the way entirely -- including not adding the "Piece" unit.
    #[tokio::test]
    async fn skips_seeding_when_products_already_exist() {
        let (conn, dir) = fresh_db().await;

        let unit = unit_service::create(
            &conn,
            unit_service::CreateUnitInput {
                name: "Kilogram".into(),
                symbol: "kg".into(),
                conversion_factor: 1.0,
            },
        )
        .await
        .unwrap();
        product_service::create(
            &conn,
            product_service::CreateProductInput {
                sku: "CUSTOM-1".into(),
                name: "Operator's own product".into(),
                description: None,
                base_unit_id: unit.id,
                specifications: None,
                reorder_level: 5.0,
            },
        )
        .await
        .unwrap();

        let created = ensure_default_products(&conn).await.unwrap();
        assert_eq!(created, 0);

        let products = product_service::list(&conn, true).await.unwrap();
        assert_eq!(products.len(), 1, "must not touch a curated catalogue");
        assert!(find_unit_by_name(&conn, DEFAULT_UNIT_NAME)
            .await
            .unwrap()
            .is_none());

        let _ = std::fs::remove_dir_all(dir);
    }
}
