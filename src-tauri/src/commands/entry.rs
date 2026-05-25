use specdex_core::entry::{CreateEntry, CreateEntryResult, EntryRepo, ListEntries, UpdateEntry};
use specdex_core::kb::KbRepo;
use specdex_core::models::entry::{Entry, EntryData, SourceRef};
use specdex_core::models::ids::{EntryId, KbId, SourceDocId};
use specdex_core::CoreError;

use crate::state::AppState;

#[derive(serde::Deserialize, specta::Type)]
pub struct CreateEntryArgs {
    pub kb_id: KbId,
    pub data: EntryData,
    pub aliases: Vec<String>,
    pub source: Option<SourceRef>,
    pub notes: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn entry_create(
    state: tauri::State<'_, AppState>,
    args: CreateEntryArgs,
) -> Result<CreateEntryResult, CoreError> {
    let repo = EntryRepo::new(&state.db, &state.events, state.identity());
    let res = repo.create(CreateEntry {
        kb_id: args.kb_id,
        data: args.data,
        aliases: args.aliases,
        source: args.source,
        notes: args.notes,
    })?;
    state.scanner.invalidate();
    let kb = KbRepo::new(&state.db, &state.events, state.identity()).get(res.entry.kb_id)?;
    state.search.entries.upsert_entry(
        res.entry.id,
        res.entry.kb_id,
        &kb.name,
        &res.entry.primary_value,
        &serde_json::to_string(&res.entry.data)?,
        &res.entry.aliases,
    )?;
    Ok(res)
}

#[tauri::command]
#[specta::specta]
pub fn entry_get(state: tauri::State<'_, AppState>, entry_id: EntryId) -> Result<Entry, CoreError> {
    EntryRepo::new(&state.db, &state.events, state.identity()).get(entry_id)
}

#[derive(serde::Deserialize, specta::Type)]
pub struct ListEntriesArgs {
    pub kb_id: KbId,
    pub filter: Option<String>,
    pub source_doc_id: Option<SourceDocId>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[tauri::command]
#[specta::specta]
pub fn entry_list(
    state: tauri::State<'_, AppState>,
    args: ListEntriesArgs,
) -> Result<Vec<Entry>, CoreError> {
    EntryRepo::new(&state.db, &state.events, state.identity()).list(ListEntries {
        kb_id: args.kb_id,
        filter: args.filter,
        source_doc_id: args.source_doc_id,
        limit: args.limit,
        offset: args.offset,
    })
}

#[derive(serde::Deserialize, specta::Type)]
pub struct UpdateEntryArgs {
    pub data: Option<EntryData>,
    pub aliases: Option<Vec<String>>,
    pub source: Option<Option<SourceRef>>,
    pub notes: Option<Option<String>>,
}

#[tauri::command]
#[specta::specta]
pub fn entry_update(
    state: tauri::State<'_, AppState>,
    entry_id: EntryId,
    patch: UpdateEntryArgs,
) -> Result<Entry, CoreError> {
    let repo = EntryRepo::new(&state.db, &state.events, state.identity());
    let updated = repo.update(
        entry_id,
        UpdateEntry {
            data: patch.data,
            aliases: patch.aliases,
            source: patch.source,
            notes: patch.notes,
        },
    )?;
    state.scanner.invalidate();
    let kb = KbRepo::new(&state.db, &state.events, state.identity()).get(updated.kb_id)?;
    state.search.entries.upsert_entry(
        updated.id,
        updated.kb_id,
        &kb.name,
        &updated.primary_value,
        &serde_json::to_string(&updated.data)?,
        &updated.aliases,
    )?;
    Ok(updated)
}

#[tauri::command]
#[specta::specta]
pub fn entry_delete(state: tauri::State<'_, AppState>, entry_id: EntryId) -> Result<(), CoreError> {
    EntryRepo::new(&state.db, &state.events, state.identity()).delete(entry_id)?;
    state.scanner.invalidate();
    state.search.entries.delete_entry(entry_id)?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn entry_bulk_delete(
    state: tauri::State<'_, AppState>,
    entry_ids: Vec<EntryId>,
) -> Result<u32, CoreError> {
    let repo = EntryRepo::new(&state.db, &state.events, state.identity());
    let n = u32::try_from(repo.bulk_delete(&entry_ids)?).unwrap_or(u32::MAX);
    state.scanner.invalidate();
    for id in &entry_ids {
        let _ = state.search.entries.delete_entry(*id);
    }
    Ok(n)
}
