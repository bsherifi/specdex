use specdex_core::kb::{CreateKb, KbRepo, UpdateKbMeta};
use specdex_core::models::ids::KbId;
use specdex_core::models::kb::{Kb, KbSummary};
use specdex_core::models::schema::Schema;
use specdex_core::schema_migration::{migrate_schema, MigrateSchema, MigrationReport};
use specdex_core::CoreError;

use crate::state::AppState;

#[derive(serde::Deserialize, specta::Type)]
pub struct CreateKbArgs {
    pub name: String,
    pub description: Option<String>,
    pub schema: Schema,
    pub highlight_color: String,
}

#[tauri::command]
#[specta::specta]
pub fn kb_create(state: tauri::State<'_, AppState>, args: CreateKbArgs) -> Result<Kb, CoreError> {
    let repo = KbRepo::new(&state.db, &state.events, state.identity());
    repo.create(CreateKb {
        name: args.name,
        description: args.description,
        schema: args.schema,
        highlight_color: args.highlight_color,
    })
}

#[tauri::command]
#[specta::specta]
pub fn kb_get(state: tauri::State<'_, AppState>, kb_id: KbId) -> Result<Kb, CoreError> {
    KbRepo::new(&state.db, &state.events, state.identity()).get(kb_id)
}

#[tauri::command]
#[specta::specta]
pub fn kb_list(state: tauri::State<'_, AppState>) -> Result<Vec<Kb>, CoreError> {
    KbRepo::new(&state.db, &state.events, state.identity()).list()
}

#[tauri::command]
#[specta::specta]
pub fn kb_list_summaries(state: tauri::State<'_, AppState>) -> Result<Vec<KbSummary>, CoreError> {
    KbRepo::new(&state.db, &state.events, state.identity()).list_summaries()
}

#[derive(serde::Deserialize, specta::Type)]
pub struct UpdateKbMetaArgs {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub highlight_color: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn kb_update_meta(
    state: tauri::State<'_, AppState>,
    kb_id: KbId,
    patch: UpdateKbMetaArgs,
) -> Result<Kb, CoreError> {
    KbRepo::new(&state.db, &state.events, state.identity()).update_meta(
        kb_id,
        UpdateKbMeta {
            name: patch.name,
            description: patch.description,
            highlight_color: patch.highlight_color,
        },
    )
}

#[tauri::command]
#[specta::specta]
pub fn kb_delete(state: tauri::State<'_, AppState>, kb_id: KbId) -> Result<(), CoreError> {
    let repo = KbRepo::new(&state.db, &state.events, state.identity());
    repo.delete(kb_id)?;
    state.scanner.invalidate();
    state.search.entries.delete_kb(kb_id).ok();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn kb_migrate_schema(
    state: tauri::State<'_, AppState>,
    kb_id: KbId,
    new_schema: Schema,
) -> Result<MigrationReport, CoreError> {
    let report = migrate_schema(
        &state.db,
        &state.events,
        MigrateSchema {
            kb_id,
            new_schema,
            initiated_by: state.identity(),
        },
    )?;
    state.scanner.invalidate();
    state.search.entries.rebuild_from_db(&state.db)?;
    Ok(report)
}
