//! Specdex core — domain types and business logic.
//!
//! Layout:
//!  - `models`   — pure data types (plan 10).
//!  - `error`    — `CoreError` enum (plan 10).
//!  - `db`       — `SQLite` connection + migrations (plan 11).
//!  - `events`   — broadcast event bus (plan 12).
//!  - `kb`/`identity`/`schema_migration` — business logic (plan 12+).
//!
//! Per SPECDEX-V1.md §10, this crate is transport-agnostic: no Tauri, no HTTP.

pub mod db;
pub mod entry;
pub mod entry_validation;
pub mod error;
pub mod events;
pub mod identity;
pub mod kb;
pub mod models;
pub mod schema_migration;

pub use error::CoreError;
pub use events::EventBus;
pub use models::*;

pub type Result<T> = std::result::Result<T, CoreError>;
