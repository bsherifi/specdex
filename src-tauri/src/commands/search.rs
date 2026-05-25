use specdex_core::search::types::{EntryHit, SourceDocHit};
use specdex_core::CoreError;

use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn search_entries(
    state: tauri::State<'_, AppState>,
    q: String,
    limit: u32,
) -> Result<Vec<EntryHit>, CoreError> {
    state.search.entries.search(&q, limit as usize)
}

#[tauri::command]
#[specta::specta]
pub fn search_source_docs(
    state: tauri::State<'_, AppState>,
    q: String,
    limit: u32,
) -> Result<Vec<SourceDocHit>, CoreError> {
    state.search.source_docs.search(&q, limit as usize)
}
