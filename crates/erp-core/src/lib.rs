//! Shared domain layer for Preyansh ERP: SeaORM entities, business
//! services, auth, and validation. Used by both `erp-server` (Axum HTTP
//! API) and directly by Tauri commands where an HTTP round-trip would be
//! unnecessary overhead (e.g. resolving the DB path on startup).
//!
//! Keeping this crate free of any web-framework dependency (no axum, no
//! `http` types) is deliberate: it is the piece that has to run unchanged
//! whether it is embedded in the desktop app today or moved behind a
//! standalone sync server tomorrow.

pub mod auth;
pub mod db;
pub mod domain;
pub mod entities;
pub mod error;
pub mod services;

pub use error::{AppError, AppResult};
