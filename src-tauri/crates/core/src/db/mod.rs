//! `Db` — owns the `SQLite` connection. Single-writer Mutex.

pub mod migrations;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::CoreError;

/// Owned `SQLite` connection wrapped in a Mutex for safe sharing across the
/// async runtime. v1 is single-user so contention is negligible; plan 15's
/// ingest worker holds the lock briefly per write.
pub struct Db {
    inner: Mutex<Connection>,
}

impl Db {
    /// Opens the `SQLite` file at `path`, creating it (and parent dirs) if
    /// necessary, then runs all pending migrations.
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self, CoreError> {
        if let Some(parent) = path.as_ref().parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut conn = Connection::open(&path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        migrations::migrate(&mut conn)?;
        Ok(Self {
            inner: Mutex::new(conn),
        })
    }

    /// Opens an in-memory DB for tests.
    pub fn open_memory() -> Result<Self, CoreError> {
        let mut conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        migrations::migrate(&mut conn)?;
        Ok(Self {
            inner: Mutex::new(conn),
        })
    }

    /// Runs `f` against an exclusive Connection handle. Most callers will
    /// use this; specialized repos may borrow the lock directly.
    pub fn with<R>(
        &self,
        f: impl FnOnce(&Connection) -> Result<R, CoreError>,
    ) -> Result<R, CoreError> {
        let guard = self
            .inner
            .lock()
            .map_err(|e| CoreError::Internal(format!("db mutex poisoned: {e}")))?;
        f(&guard)
    }

    /// Mutable variant for transactions.
    pub fn with_mut<R>(
        &self,
        f: impl FnOnce(&mut Connection) -> Result<R, CoreError>,
    ) -> Result<R, CoreError> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|e| CoreError::Internal(format!("db mutex poisoned: {e}")))?;
        f(&mut guard)
    }

    pub fn current_version(&self) -> Result<u32, CoreError> {
        self.with(migrations::current_version)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_memory_runs_migrations() {
        let db = Db::open_memory().unwrap();
        assert_eq!(db.current_version().unwrap(), 1);
    }

    #[test]
    fn open_file_creates_parent_dirs() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("nested").join("specdex.sqlite");
        let db = Db::open(&path).unwrap();
        assert_eq!(db.current_version().unwrap(), 1);
        assert!(path.exists());
    }
}
