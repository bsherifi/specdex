//! Anchors paths for the docs/ subdir, attachments/, tantivy/, logs/.
//!
//! In production this is populated from `tauri::path::app_data_dir`. In tests
//! it points at a `tempfile::TempDir` (see test helpers).

use std::path::{Path, PathBuf};

use crate::Result;

#[derive(Debug, Clone)]
pub struct AppDataDir {
    root: PathBuf,
}

impl AppDataDir {
    pub fn new(root: impl Into<PathBuf>) -> Result<Self> {
        let root = root.into();
        std::fs::create_dir_all(&root)?;
        for sub in ["docs", "attachments", "tantivy", "logs"] {
            std::fs::create_dir_all(root.join(sub))?;
        }
        Ok(Self { root })
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    #[must_use]
    pub fn docs(&self) -> PathBuf {
        self.root.join("docs")
    }

    #[must_use]
    pub fn attachments(&self) -> PathBuf {
        self.root.join("attachments")
    }

    #[must_use]
    pub fn tantivy(&self) -> PathBuf {
        self.root.join("tantivy")
    }

    #[must_use]
    pub fn logs(&self) -> PathBuf {
        self.root.join("logs")
    }

    #[must_use]
    pub fn db_path(&self) -> PathBuf {
        self.root.join("specdex.sqlite")
    }

    /// Returns a relative `docs/<id>.pdf` path for a given doc id.
    #[must_use]
    pub fn doc_relative_path(&self, doc_id: crate::models::ids::SourceDocId, ext: &str) -> String {
        let ext = ext.trim_start_matches('.');
        format!("docs/{doc_id}.{ext}")
    }
}

impl Default for AppDataDir {
    fn default() -> Self {
        // Disallow default in production; tests should use `tempfile::tempdir()`.
        Self::new(std::env::temp_dir().join("specdex-default-bad"))
            .expect("default AppDataDir failed")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_creates_all_subdirs() {
        let tmp = tempfile::tempdir().unwrap();
        let app = AppDataDir::new(tmp.path()).unwrap();
        assert!(app.docs().exists());
        assert!(app.attachments().exists());
        assert!(app.tantivy().exists());
        assert!(app.logs().exists());
    }
}
