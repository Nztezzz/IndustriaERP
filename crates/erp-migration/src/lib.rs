pub use sea_orm_migration::prelude::*;

/// Entry point for the standalone `erp-migrate` CLI binary (see `main.rs`).
/// Reads `DATABASE_URL` from the environment, same as any sea-orm-cli setup.
pub async fn run() {
    sea_orm_migration::cli::run_cli(Migrator).await;
}

mod m20260725_000001_create_roles_and_users;
mod m20260725_000002_create_units_and_products;
mod m20260725_000003_create_customers;
mod m20260725_000004_create_dispatches;
mod m20260725_000005_create_reels;
mod m20260725_000006_create_stock_ledger;
mod m20260725_000007_create_audit_and_backups;
mod m20260801_000008_create_packing_slips;

pub struct Migrator;

/// Migrations run in the order listed here, oldest first. The ordering
/// deliberately resolves foreign-key dependencies: master data (roles,
/// users, units, products, customers) before dispatches/reels, then the
/// stock ledger last since `stock_movements.dispatch_id` references
/// `dispatches`.
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260725_000001_create_roles_and_users::Migration),
            Box::new(m20260725_000002_create_units_and_products::Migration),
            Box::new(m20260725_000003_create_customers::Migration),
            Box::new(m20260725_000004_create_dispatches::Migration),
            Box::new(m20260725_000005_create_reels::Migration),
            Box::new(m20260725_000006_create_stock_ledger::Migration),
            Box::new(m20260725_000007_create_audit_and_backups::Migration),
            Box::new(m20260801_000008_create_packing_slips::Migration),
        ]
    }
}
