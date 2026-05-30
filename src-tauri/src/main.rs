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

/// Relative path to the pdfium shared library inside a `binaries/` root,
/// for the current platform.
fn pdfium_rel_path() -> &'static str {
    if cfg!(target_os = "windows") {
        "pdfium/windows-x64/x64/bin/pdfium.dll"
    } else if cfg!(target_os = "macos") {
        "pdfium/macos-arm/lib/libpdfium.dylib"
    } else {
        "pdfium/linux/lib/libpdfium.so"
    }
}

/// A path that exists and is a non-empty file. A 0-byte file (e.g. a failed
/// download stub) must NOT count as a usable library: handing it to pdfium
/// fails and silently degrades the whole app to `MockParser`.
fn is_usable_file(p: &std::path::Path) -> bool {
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

fn resolve_pdfium_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(p) = std::env::var("SPECDEX_PDFIUM_PATH") {
        return Some(PathBuf::from(p));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidate = resource_dir.join("binaries").join(pdfium_rel_path());
        if is_usable_file(&candidate) {
            return Some(candidate);
        }
    }
    // Debug builds run under `tauri dev`, where the bundle's resource dir isn't
    // populated. Fall back to the in-repo `src-tauri/binaries/` so the real
    // parser (not MockParser) is exercised during development.
    #[cfg(debug_assertions)]
    {
        let candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(pdfium_rel_path());
        if is_usable_file(&candidate) {
            return Some(candidate);
        }
    }
    None
}

/// Returns (`detection_model_path`, `recognition_model_path`). Both fall back
/// to env vars (used in dev/CI before the bundle has been built).
fn resolve_ocrs_model_paths(app: &tauri::AppHandle) -> (PathBuf, PathBuf) {
    let env_det = std::env::var("SPECDEX_OCRS_DETECTION_MODEL")
        .ok()
        .map(PathBuf::from);
    let env_rec = std::env::var("SPECDEX_OCRS_RECOGNITION_MODEL")
        .ok()
        .map(PathBuf::from);
    if let (Some(d), Some(r)) = (env_det.clone(), env_rec.clone()) {
        return (d, r);
    }
    // Prefer the bundle's resource dir; in debug builds (`tauri dev`) that dir
    // isn't populated, so fall back to the in-repo `src-tauri/binaries/ocrs`.
    let has_models = |d: &std::path::Path| {
        is_usable_file(&d.join("text-detection.rten"))
            && is_usable_file(&d.join("text-recognition.rten"))
    };
    let bundled = app
        .path()
        .resource_dir()
        .ok()
        .map(|rd| rd.join("binaries").join("ocrs"))
        .filter(|p| has_models(p));
    #[cfg(debug_assertions)]
    let bundled = bundled.or_else(|| {
        Some(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries").join("ocrs"))
            .filter(|p| has_models(p))
    });
    let det = env_det
        .or_else(|| bundled.as_ref().map(|p| p.join("text-detection.rten")))
        .unwrap_or_else(|| PathBuf::from("./binaries/ocrs/text-detection.rten"));
    let rec = env_rec
        .or_else(|| bundled.as_ref().map(|p| p.join("text-recognition.rten")))
        .unwrap_or_else(|| PathBuf::from("./binaries/ocrs/text-recognition.rten"));
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
            // pdfium is a process-wide singleton: bind it ONCE and share the
            // handle with both the PDF and OCR parsers. Constructing two
            // `Pdfium` instances deadlocks on pdfium-render's thread marshall.
            let pdfium_path = resolve_pdfium_path(app.handle());
            let (pdfium_parser, ocr_parser): (Arc<dyn DocumentParser>, Arc<dyn DocumentParser>) =
                match specdex_parsers::bind_pdfium(pdfium_path.as_deref()) {
                    Ok(shared) => {
                        let pdf: Arc<dyn DocumentParser> =
                            Arc::new(PdfiumParser::with_shared(shared.clone()));
                        let (ocrs_det, ocrs_rec) = resolve_ocrs_model_paths(app.handle());
                        let ocr: Arc<dyn DocumentParser> =
                            match OcrParser::with_shared(shared, &ocrs_det, &ocrs_rec) {
                                Ok(p) => Arc::new(p),
                                Err(e) => {
                                    tracing::warn!(?e, "ocrs models unavailable; using permissive MockParser");
                                    Arc::new(MockParser::permissive())
                                }
                            };
                        (pdf, ocr)
                    }
                    Err(e) => {
                        tracing::warn!(?e, "pdfium unavailable; using permissive MockParser");
                        (
                            Arc::new(MockParser::permissive()),
                            Arc::new(MockParser::permissive()),
                        )
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
        .run(tauri::generate_context!())
        .expect("error while running Specdex");
}
