//! Migration runner. Forward-only; each migration is identified by a
//! monotonic integer version that's recorded in `schema_migrations`
//! after successful apply.

use rusqlite::Connection;

use crate::CoreError;

/// One migration. The SQL is embedded at compile time via `include_str!`.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "initial",
    sql: include_str!("migrations/0001_initial.sql"),
}];

/// Apply all pending migrations.
///
/// Idempotent: if the DB is already up to date, returns `Ok(0)`. On error,
/// the current migration is rolled back via SAVEPOINT but earlier migrations
/// remain applied.
pub fn migrate(conn: &mut Connection) -> Result<u32, CoreError> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        ) STRICT;",
    )?;

    let mut applied = 0u32;
    for m in MIGRATIONS {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM schema_migrations WHERE version = ?1",
                [m.version],
                |_| Ok(true),
            )
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(false),
                other => Err(other),
            })?;
        if exists {
            continue;
        }

        let tx = conn.transaction()?;
        tx.execute_batch(m.sql)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            (m.version, chrono::Utc::now().to_rfc3339()),
        )?;
        tx.commit()?;
        tracing::info!(version = m.version, name = m.name, "applied migration");
        applied += 1;
    }
    Ok(applied)
}

/// Returns the highest applied version, or 0 if no migrations have run.
pub fn current_version(conn: &Connection) -> Result<u32, CoreError> {
    let v: Option<u32> = conn
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get::<_, Option<u32>>(0)
        })
        .or_else(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => Ok(None),
            other => Err(other),
        })?;
    Ok(v.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open() -> Connection {
        Connection::open_in_memory().unwrap()
    }

    #[test]
    fn migrate_creates_expected_tables() {
        let mut conn = open();
        let applied = migrate(&mut conn).unwrap();
        assert_eq!(applied, 1);

        // Each expected table is present.
        for table in [
            "knowledge_bases",
            "entries",
            "source_documents",
            "identity",
            "app_meta",
            "schema_history",
            "schema_migrations",
        ] {
            let exists: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(exists, 1, "table {table} missing");
        }
    }

    #[test]
    fn migrate_creates_expected_indexes() {
        let mut conn = open();
        migrate(&mut conn).unwrap();
        for idx in [
            "idx_entries_kb_id",
            "idx_entries_kb_id_primary",
            "idx_entries_source_doc_id",
            "idx_source_documents_ingested_at",
            "idx_schema_history_kb_id",
        ] {
            let exists: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                    [idx],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(exists, 1, "index {idx} missing");
        }
    }

    #[test]
    fn migrate_is_idempotent() {
        let mut conn = open();
        assert_eq!(migrate(&mut conn).unwrap(), 1);
        assert_eq!(migrate(&mut conn).unwrap(), 0);
        assert_eq!(current_version(&conn).unwrap(), 1);
    }

    #[test]
    fn foreign_keys_cascade_entries_when_kb_deleted() {
        let mut conn = open();
        migrate(&mut conn).unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO knowledge_bases (id, name, schema_json, primary_field, searchable_fields_json, highlight_color, created_at, updated_at)
             VALUES ('kb1', 'kb1', '[]', 'code', '[]', '#000', ?1, ?1)",
            [&now],
        ).unwrap();
        conn.execute(
            "INSERT INTO entries (id, kb_id, primary_value, data_json, created_at, updated_at)
             VALUES ('e1', 'kb1', 'BAC', '{}', ?1, ?1)",
            [&now],
        )
        .unwrap();
        conn.execute("DELETE FROM knowledge_bases WHERE id = 'kb1'", [])
            .unwrap();
        let n: i64 = conn
            .query_row("SELECT count(*) FROM entries", [], |row| row.get(0))
            .unwrap();
        assert_eq!(n, 0, "entries should cascade-delete with their KB");
    }

    #[test]
    fn identity_table_enforces_single_row() {
        let mut conn = open();
        migrate(&mut conn).unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO identity (id, display_name, created_at) VALUES (1, 'Sara', ?1)",
            [&now],
        )
        .unwrap();
        let err = conn.execute(
            "INSERT INTO identity (id, display_name, created_at) VALUES (2, 'Bob', ?1)",
            [&now],
        );
        assert!(err.is_err(), "CHECK (id = 1) should block second row");
    }
}
