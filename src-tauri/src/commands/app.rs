//! `app` commands — version + diagnostics. Plan 04 ships only `get_app_version`.

use serde::Serialize;
use specta::Type;

#[derive(Debug, Clone, Serialize, Type)]
pub struct AppVersion {
    pub app: String,
    pub git_short_sha: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn get_app_version() -> AppVersion {
    AppVersion {
        app: env!("CARGO_PKG_VERSION").to_string(),
        git_short_sha: option_env!("SPECDEX_GIT_SHA").map(str::to_string),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_struct_is_serializable_with_pkg_version() {
        let v = get_app_version();
        assert!(!v.app.is_empty());
        let json = serde_json::to_value(&v).expect("AppVersion must serialize");
        assert_eq!(json["app"], v.app);
    }
}
