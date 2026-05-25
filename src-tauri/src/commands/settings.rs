use serde::{Deserialize, Serialize};
use specta::Type;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppSettings {
    pub data_dir: String,
    pub log_dir: String,
    pub pdfium_version: String,
    pub ocrs_version: String,
    pub tantivy_version: String,
}

#[tauri::command]
#[specta::specta]
pub fn get_app_settings(state: tauri::State<'_, AppState>) -> AppSettings {
    AppSettings {
        data_dir: state.app_data.root().display().to_string(),
        log_dir: state.app_data.logs().display().to_string(),
        pdfium_version: "bundled (PDFium / pdfium-render 0.8)".into(),
        ocrs_version: "bundled (ocrs 0.10)".into(),
        tantivy_version: "0.22".into(),
    }
}

#[tauri::command]
#[specta::specta]
pub fn reveal_in_file_manager(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let res = std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .status();
    #[cfg(target_os = "windows")]
    let res = std::process::Command::new("explorer.exe")
        .arg("/select,")
        .arg(&path)
        .status();
    #[cfg(target_os = "linux")]
    let res = std::process::Command::new("xdg-open").arg(&path).status();
    res.map_err(|e| e.to_string()).and_then(|s| {
        if s.success() {
            Ok(())
        } else {
            Err(format!("file manager exited {:?}", s.code()))
        }
    })
}
