use specdex_core::models::ids::SourceDocId;
use specdex_core::models::scan::{Match, ScanScope};
use specdex_core::CoreError;

use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn scan_document(
    state: tauri::State<'_, AppState>,
    source_doc_id: SourceDocId,
    scope: ScanScope,
) -> Result<Vec<Match>, CoreError> {
    state.scanner.scan(&state.db, source_doc_id, scope)
}

#[tauri::command]
#[specta::specta]
pub fn scanner_invalidate(state: tauri::State<'_, AppState>) -> Result<(), CoreError> {
    state.scanner.invalidate();
    Ok(())
}
