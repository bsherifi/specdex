//! Tauri command modules. Each submodule owns a domain slice: KBs / entries /
//! ingest / source docs / search / scanner / identity / settings. Per §10 each
//! command is a thin deserialize → call `core` → serialize shim.
//!
//! These three pedantic lints are intrinsic to the Tauri command shape, so we
//! exempt the whole module (the allows cascade to every submodule):
//!  - `needless_pass_by_value`: commands receive `State` + owned deserialized
//!    args by value because that is Tauri's `Command` contract (mirrors the
//!    existing exemption on `core::scanner::Scanner::scan`).
//!  - `unnecessary_wraps`: infallible commands still return `Result<_, CoreError>`
//!    so the whole surface presents one uniform error shape to the frontend.
//!  - `option_option`: tri-state patch fields (absent / clear / set) mirror the
//!    `UpdateKbMeta` / `UpdateEntry` core types.
#![allow(
    clippy::needless_pass_by_value,
    clippy::unnecessary_wraps,
    clippy::option_option
)]

pub mod app;
pub mod entry;
pub mod identity;
pub mod ingest;
pub mod kb;
pub mod scanner;
pub mod search;
pub mod settings;
pub mod source_doc;
