//! Tauri-managed `AppState`. Constructed once at startup; every command
//! receives a reference via `State<'_, AppState>`.

use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use specdex_core::app_data::AppDataDir;
use specdex_core::db::Db;
use specdex_core::events::EventBus;
use specdex_core::parse::DocumentParser;
use specdex_core::scanner::Scanner;
use specdex_core::search::Search;
use tauri::Manager;

pub struct AppState {
    pub db: Arc<Db>,
    pub events: Arc<EventBus>,
    pub app_data: AppDataDir,
    pub scanner: Arc<Scanner>,
    pub search: Arc<Search>,
    pub pdfium_parser: Arc<dyn DocumentParser>,
    pub ocr_parser: Arc<dyn DocumentParser>,
    pub identity_name: RwLock<Option<String>>,
}

impl AppState {
    pub fn identity(&self) -> Option<String> {
        self.identity_name.read().unwrap().clone()
    }

    pub fn set_identity(&self, name: Option<String>) {
        *self.identity_name.write().unwrap() = name;
    }
}

/// Resolves `~/Library/Application Support/Specdex` / `%APPDATA%\Specdex` /
/// `~/.local/share/Specdex` via Tauri's path resolver, falling back to
/// `$SPECDEX_DATA_DIR` for dev/test overrides.
pub fn resolve_app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("SPECDEX_DATA_DIR") {
        return Ok(PathBuf::from(p));
    }
    app.path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app_data_dir: {e}"))
}
