//! Specdex Tauri adapter — binary entry point.
//!
//! This file is intentionally tiny in plan 02: bootstrap Tauri, install
//! tracing, open the main window. Per SPECDEX-V1.md §10, all business
//! logic lives in `specdex_core`; this binary will accumulate thin
//! command wrappers in plan 20.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn init_tracing() {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,specdex=debug"));
    tracing_subscriber::registry()
        .with(fmt::layer().with_target(false).compact())
        .with(filter)
        .init();
}

fn main() {
    init_tracing();
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        "specdex starting (plan 02 shell)"
    );

    tauri::Builder::default()
        .setup(|_app| {
            tracing::info!("specdex window ready");
            Ok(())
        })
        // Config lives at the workspace root per SPECDEX-V1.md §9.4; this
        // path is relative to CARGO_MANIFEST_DIR (crates/tauri_adapter/).
        .run(tauri::generate_context!("../../tauri.conf.json"))
        .expect("error while running Specdex");
}
