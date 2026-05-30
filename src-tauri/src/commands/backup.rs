use std::path::PathBuf;

use specdex_core::backup::{
    export_full, export_kb_json, import_kb_json, restore_full, BackupManifest, KbExport,
};
use specdex_core::models::ids::KbId;
use specdex_core::CoreError;

use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn backup_export(
    state: tauri::State<'_, AppState>,
    out_path: String,
) -> Result<BackupManifest, CoreError> {
    export_full(&state.db, &state.app_data, &PathBuf::from(out_path))
}

#[tauri::command]
#[specta::specta]
pub fn backup_restore(
    state: tauri::State<'_, AppState>,
    zip_path: String,
) -> Result<BackupManifest, CoreError> {
    let manifest = restore_full(
        &state.db,
        &state.app_data,
        &state.events,
        &PathBuf::from(zip_path),
    )?;
    // Rebuild scanner + Tantivy from new state.
    state.scanner.invalidate();
    state.search.entries.rebuild_from_db(&state.db)?;
    state.search.source_docs.rebuild_from_db(&state.db)?;
    Ok(manifest)
}

#[tauri::command]
#[specta::specta]
pub fn kb_export_json(
    state: tauri::State<'_, AppState>,
    kb_id: KbId,
) -> Result<KbExport, CoreError> {
    export_kb_json(&state.db, kb_id)
}

#[tauri::command]
#[specta::specta]
pub fn kb_import_json(
    state: tauri::State<'_, AppState>,
    json: String,
) -> Result<specdex_core::models::kb::Kb, CoreError> {
    let kb = import_kb_json(&state.db, &state.events, &json, state.identity())?;
    state.search.entries.rebuild_from_db(&state.db)?;
    Ok(kb)
}
