use specdex_core::models::ids::SourceDocId;
use specdex_core::models::source_document::SourceDocument;
use specdex_core::source_doc::SourceDocRepo;
use specdex_core::CoreError;

use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn source_doc_get(
    state: tauri::State<'_, AppState>,
    source_doc_id: SourceDocId,
) -> Result<SourceDocument, CoreError> {
    SourceDocRepo::new(&state.db).get(source_doc_id)
}

#[tauri::command]
#[specta::specta]
pub fn source_doc_delete(
    state: tauri::State<'_, AppState>,
    source_doc_id: SourceDocId,
) -> Result<(), CoreError> {
    SourceDocRepo::new(&state.db).delete(source_doc_id)?;
    state.scanner.invalidate_doc(source_doc_id);
    state.search.source_docs.delete(source_doc_id)?;
    Ok(())
}

/// Absolute path on disk to a stored PDF. The frontend's pdf.js fetches via
/// Tauri's asset protocol; this command returns the path the asset handler
/// reads from.
#[tauri::command]
#[specta::specta]
pub fn source_doc_resolve_path(
    state: tauri::State<'_, AppState>,
    source_doc_id: SourceDocId,
) -> Result<String, CoreError> {
    let doc = SourceDocRepo::new(&state.db).get(source_doc_id)?;
    Ok(state
        .app_data
        .root()
        .join(&doc.stored_path)
        .to_string_lossy()
        .to_string())
}
