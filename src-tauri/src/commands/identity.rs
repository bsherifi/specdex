use specdex_core::identity::IdentityRepo;
use specdex_core::models::identity::Identity;
use specdex_core::CoreError;

use crate::state::AppState;

#[tauri::command]
#[specta::specta]
pub fn identity_get(state: tauri::State<'_, AppState>) -> Result<Option<Identity>, CoreError> {
    let repo = IdentityRepo::new(&state.db, &state.events);
    repo.get()
}

#[tauri::command]
#[specta::specta]
pub fn identity_set(
    state: tauri::State<'_, AppState>,
    display_name: String,
) -> Result<Identity, CoreError> {
    let repo = IdentityRepo::new(&state.db, &state.events);
    let id = repo.set(&display_name)?;
    state.set_identity(Some(id.display_name.clone()));
    Ok(id)
}
