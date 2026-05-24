//! Specdex core — domain types and business logic.
//!
//! Layout:
//!  - `models`   — pure data types (this plan, 10).
//!  - `error`    — `CoreError` enum (this plan).
//!  - `db`       — `SQLite` repos (plan 11+).
//!  - `kb`/`entry`/`schema`/`ingest`/`scanner`/`search`/`backup`/`identity`/
//!    `events`/`jobs` — business logic (plans 12–17, 40).
//!
//! Per SPECDEX-V1.md §10, this crate is transport-agnostic: no Tauri, no HTTP.

pub mod error;
pub mod models;

pub use error::CoreError;
pub use models::*;

pub type Result<T> = std::result::Result<T, CoreError>;
