//! Standalone migration CLI for local development.
//!
//! Usage (from the workspace root):
//!   $env:DATABASE_URL="sqlite://./dev.db?mode=rwc"; cargo run -p erp-migration -- up
//!   $env:DATABASE_URL="sqlite://./dev.db?mode=rwc"; cargo run -p erp-migration -- status
//!
//! In the shipped app, migrations run automatically on startup via
//! `erp_core::db::init` calling `Migrator::up` programmatically against the
//! SQLite file resolved from Tauri's app-data directory -- this binary is
//! only needed for local schema iteration.
#[tokio::main]
async fn main() {
    erp_migration::run().await;
}
