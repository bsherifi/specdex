//! Specdex Tauri adapter — binary entry point.
//!
//! Per SPECDEX-V1.md §10, all business logic lives in `specdex_core`; this
//! binary stays a thin command layer: it constructs `AppState` once, registers
//! the command surface, and forwards `core` events to the webview.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bindings_export;
mod commands;
mod event_forwarder;
mod state;

use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use specdex_core::app_data::AppDataDir;
use specdex_core::db::Db;
use specdex_core::events::EventBus;
use specdex_core::identity::IdentityRepo;
use specdex_core::parse::DocumentParser;
use specdex_core::scanner::Scanner;
use specdex_core::search::Search;
use specdex_parsers::{MockParser, OcrParser, PdfiumParser};
use tauri::Manager;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use state::{resolve_app_data_dir, AppState};

fn init_tracing(log_dir: &std::path::Path) {
    let _ = std::fs::create_dir_all(log_dir);
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,specdex=debug"));
    // Daily-rotated file appender (blocking writes — no background guard to
    // keep alive). Stays local to disk: no network, per the §4 trust contract.
    let file_appender = tracing_appender::rolling::daily(log_dir, "specdex.log");
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_target(false).compact())
        .with(fmt::layer().with_writer(file_appender).with_ansi(false))
        .init();
}

fn resolve_pdfium_path() -> Option<PathBuf> {
    std::env::var_os("SPECDEX_PDFIUM_PATH").map(PathBuf::from)
}

fn resolve_ocrs_model_paths() -> (PathBuf, PathBuf) {
    let det = std::env::var_os("SPECDEX_OCRS_DETECTION_MODEL").map_or_else(
        || PathBuf::from("./binaries/ocrs/text-detection.rten"),
        PathBuf::from,
    );
    let rec = std::env::var_os("SPECDEX_OCRS_RECOGNITION_MODEL").map_or_else(
        || PathBuf::from("./binaries/ocrs/text-recognition.rten"),
        PathBuf::from,
    );
    (det, rec)
}

fn main() {
    // `--export-bindings`: write bindings.ts and exit. Used by `pnpm bindings`
    // so CI / dev can refresh types without launching a window.
    if std::env::args().any(|a| a == "--export-bindings") {
        bindings_export::export().expect("failed to export bindings");
        return;
    }

    let specta_builder = bindings_export::builder();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(specta_builder.invoke_handler())
        .setup(move |app| {
            // Resolve data dir + open db.
            let data_dir = resolve_app_data_dir(app.handle())?;
            let app_data = AppDataDir::new(data_dir)?;
            init_tracing(&app_data.logs());

            // Debug builds re-export bindings at startup so dev iteration stays
            // in sync without remembering to run `pnpm bindings`.
            #[cfg(debug_assertions)]
            if let Err(e) = bindings_export::export() {
                tracing::warn!(error = ?e, "bindings export failed; continuing");
            }

            let db = Arc::new(Db::open(app_data.db_path())?);
            let events = Arc::new(EventBus::new());
            let scanner = Arc::new(Scanner::new());
            let search = Arc::new(Search::open(&app_data.tantivy())?);

            // Parsers — fall back to MockParser if real libraries are unavailable.
            let pdfium_parser: Arc<dyn DocumentParser> =
                match PdfiumParser::new(resolve_pdfium_path().as_deref()) {
                    Ok(p) => Arc::new(p),
                    Err(e) => {
                        tracing::warn!(?e, "pdfium unavailable; using MockParser");
                        Arc::new(MockParser::new())
                    }
                };
            let (ocrs_det, ocrs_rec) = resolve_ocrs_model_paths();
            let ocr_parser: Arc<dyn DocumentParser> =
                match OcrParser::new(resolve_pdfium_path().as_deref(), &ocrs_det, &ocrs_rec) {
                    Ok(p) => Arc::new(p),
                    Err(e) => {
                        tracing::warn!(?e, "ocrs models unavailable; using MockParser");
                        Arc::new(MockParser::new())
                    }
                };

            // Load identity (if set) into AppState cache.
            let identity_name = IdentityRepo::new(&db, &events)
                .get()
                .ok()
                .flatten()
                .map(|i| i.display_name);

            let state = AppState {
                db,
                events: events.clone(),
                app_data,
                scanner,
                search,
                pdfium_parser,
                ocr_parser,
                identity_name: RwLock::new(identity_name),
            };

            // Fire up the event forwarder.
            event_forwarder::spawn(app.handle().clone(), &events);

            app.manage(state);
            specta_builder.mount_events(app);
            tracing::info!("specdex ready");
            Ok(())
        })
        // Config lives at the workspace root per SPECDEX-V1.md §9.4; this path
        // is relative to CARGO_MANIFEST_DIR (crates/tauri_adapter/).
        .run(tauri::generate_context!("../../tauri.conf.json"))
        .expect("error while running Specdex");
}
