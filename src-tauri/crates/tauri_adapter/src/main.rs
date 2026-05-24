//! Specdex Tauri adapter — binary entry point.
//!
//! Plan 04 wires tauri-specta. Plan 20 fills in the command surface.
//! Per SPECDEX-V1.md §10, all business logic lives in `specdex_core`; this
//! binary stays a thin command layer.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bindings_export;
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

    // `--export-bindings`: write bindings.ts and exit. Used by `pnpm bindings`
    // so CI / dev can refresh types without launching a window.
    if std::env::args().any(|a| a == "--export-bindings") {
        bindings_export::export().expect("failed to export bindings");
        return;
    }

    // Debug builds also export at startup so dev iteration stays in sync
    // without remembering to run `pnpm bindings`.
    #[cfg(debug_assertions)]
    if let Err(e) = bindings_export::export() {
        tracing::warn!(error = ?e, "bindings export failed; continuing anyway");
    }

    let specta_builder = bindings_export::builder();

    tauri::Builder::default()
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            specta_builder.mount_events(app);
            tracing::info!("specdex window ready");
            Ok(())
        })
        // Config lives at the workspace root per SPECDEX-V1.md §9.4; this
        // path is relative to CARGO_MANIFEST_DIR (crates/tauri_adapter/).
        .run(tauri::generate_context!("../../tauri.conf.json"))
        .expect("error while running Specdex");
}
