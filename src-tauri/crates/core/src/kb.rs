//! KB CRUD. Schema migration lives in `schema_migration.rs`.

use chrono::Utc;
use rusqlite::OptionalExtension;

use crate::db::Db;
use crate::events::EventBus;
use crate::models::event::Event;
use crate::models::ids::KbId;
use crate::models::kb::{Kb, KbSummary};
use crate::models::schema::Schema;
use crate::{CoreError, Result};

pub struct KbRepo<'db> {
    db: &'db Db,
    events: &'db EventBus,
    identity_name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CreateKb {
    pub name: String,
    pub description: Option<String>,
    pub schema: Schema,
    pub highlight_color: String,
}

#[derive(Debug, Clone, Default)]
pub struct UpdateKbMeta {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub highlight_color: Option<String>,
}

impl<'db> KbRepo<'db> {
    pub fn new(db: &'db Db, events: &'db EventBus, identity_name: Option<String>) -> Self {
        Self {
            db,
            events,
            identity_name,
        }
    }

    pub fn create(&self, args: CreateKb) -> Result<Kb> {
        args.schema
            .validate()
            .map_err(CoreError::SchemaValidation)?;
        let primary_field = args
            .schema
            .primary()
            .map(|f| f.name.clone())
            .ok_or_else(|| CoreError::Validation("schema has no primary field".into()))?;
        let searchable_fields = args.schema.searchable_field_names();

        let kb = Kb {
            id: KbId::new(),
            name: args.name,
            description: args.description,
            schema: args.schema,
            primary_field,
            searchable_fields,
            highlight_color: args.highlight_color,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            edited_by: self.identity_name.clone(),
        };

        let schema_json = serde_json::to_string(&kb.schema)?;
        let searchable_json = serde_json::to_string(&kb.searchable_fields)?;
        let now = kb.created_at.to_rfc3339();
        let id_s = kb.id.to_string();

        self.db.with_mut(|conn| {
            conn.execute(
                "INSERT INTO knowledge_bases
                   (id, name, description, schema_json, primary_field,
                    searchable_fields_json, highlight_color,
                    created_at, updated_at, edited_by)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, ?9)",
                rusqlite::params![
                    id_s,
                    kb.name,
                    kb.description,
                    schema_json,
                    kb.primary_field,
                    searchable_json,
                    kb.highlight_color,
                    now,
                    kb.edited_by,
                ],
            )
            .map_err(|e| match e {
                rusqlite::Error::SqliteFailure(ref f, ref msg)
                    if f.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE =>
                {
                    CoreError::Conflict(format!("KB name already exists: {msg:?}"))
                }
                other => other.into(),
            })?;
            Ok(())
        })?;

        self.events.emit(Event::KbCreated { kb_id: kb.id });
        Ok(kb)
    }

    pub fn get(&self, kb_id: KbId) -> Result<Kb> {
        let kb = self.find(kb_id)?;
        kb.ok_or_else(|| CoreError::NotFound(format!("kb={kb_id}")))
    }

    pub fn find(&self, kb_id: KbId) -> Result<Option<Kb>> {
        self.db.with(|conn| {
            let id_s = kb_id.to_string();
            let row = conn
                .query_row(
                    "SELECT id, name, description, schema_json, primary_field,
                            searchable_fields_json, highlight_color,
                            created_at, updated_at, edited_by
                     FROM knowledge_bases WHERE id = ?1",
                    [id_s],
                    map_kb_row,
                )
                .optional()?;
            Ok(row)
        })
    }

    pub fn list(&self) -> Result<Vec<Kb>> {
        self.db.with(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, schema_json, primary_field,
                        searchable_fields_json, highlight_color,
                        created_at, updated_at, edited_by
                 FROM knowledge_bases ORDER BY name ASC",
            )?;
            let rows = stmt
                .query_map([], map_kb_row)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })
    }

    pub fn list_summaries(&self) -> Result<Vec<KbSummary>> {
        self.db.with(|conn| {
            let mut stmt = conn.prepare(
                "SELECT kb.id, kb.name, kb.description, kb.highlight_color, kb.updated_at,
                        (SELECT count(*) FROM entries e WHERE e.kb_id = kb.id) AS entry_count
                 FROM knowledge_bases kb
                 ORDER BY kb.name ASC",
            )?;
            let rows = stmt
                .query_map([], |row| {
                    let id: String = row.get(0)?;
                    let id = id.parse::<KbId>().map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(
                            0,
                            rusqlite::types::Type::Text,
                            Box::new(e),
                        )
                    })?;
                    let updated_at: String = row.get(4)?;
                    let updated_at = updated_at
                        .parse::<chrono::DateTime<chrono::Utc>>()
                        .map_err(|e| {
                            rusqlite::Error::FromSqlConversionFailure(
                                0,
                                rusqlite::types::Type::Text,
                                Box::new(e),
                            )
                        })?;
                    Ok(KbSummary {
                        id,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        highlight_color: row.get(3)?,
                        updated_at,
                        entry_count: u64::try_from(row.get::<_, i64>(5)?).unwrap_or(0),
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })
    }

    pub fn update_meta(&self, kb_id: KbId, patch: UpdateKbMeta) -> Result<Kb> {
        let mut kb = self.get(kb_id)?;
        if let Some(n) = patch.name {
            kb.name = n;
        }
        if let Some(d) = patch.description {
            kb.description = d;
        }
        if let Some(c) = patch.highlight_color {
            kb.highlight_color = c;
        }
        kb.updated_at = Utc::now();
        kb.edited_by.clone_from(&self.identity_name);
        let id_s = kb.id.to_string();
        let updated_at = kb.updated_at.to_rfc3339();
        self.db.with_mut(|conn| {
            let affected = conn.execute(
                "UPDATE knowledge_bases
                 SET name = ?1, description = ?2, highlight_color = ?3,
                     updated_at = ?4, edited_by = ?5
                 WHERE id = ?6",
                rusqlite::params![
                    kb.name,
                    kb.description,
                    kb.highlight_color,
                    updated_at,
                    kb.edited_by,
                    id_s,
                ],
            )?;
            if affected == 0 {
                return Err(CoreError::NotFound(format!("kb={kb_id}")));
            }
            Ok(())
        })?;
        self.events.emit(Event::KbUpdated { kb_id });
        Ok(kb)
    }

    pub fn delete(&self, kb_id: KbId) -> Result<()> {
        self.db.with_mut(|conn| {
            let affected = conn.execute(
                "DELETE FROM knowledge_bases WHERE id = ?1",
                [kb_id.to_string()],
            )?;
            if affected == 0 {
                return Err(CoreError::NotFound(format!("kb={kb_id}")));
            }
            Ok(())
        })?;
        self.events.emit(Event::KbDeleted { kb_id });
        Ok(())
    }
}

fn map_kb_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Kb> {
    let id: String = row.get(0)?;
    let id = id.parse::<KbId>().map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })?;
    let schema_json: String = row.get(3)?;
    let schema: Schema = serde_json::from_str(&schema_json).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })?;
    let searchable_json: String = row.get(5)?;
    let searchable_fields: Vec<String> = serde_json::from_str(&searchable_json).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
    })?;
    let created_at: String = row.get(7)?;
    let updated_at: String = row.get(8)?;
    let created_at = created_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
        })?;
    let updated_at = updated_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(e))
        })?;
    Ok(Kb {
        id,
        name: row.get(1)?,
        description: row.get(2)?,
        schema,
        primary_field: row.get(4)?,
        searchable_fields,
        highlight_color: row.get(6)?,
        created_at,
        updated_at,
        edited_by: row.get(9)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::schema::{FieldDef, FieldType};

    fn fresh() -> (Db, EventBus) {
        (Db::open_memory().unwrap(), EventBus::new())
    }

    fn boeing_schema() -> Schema {
        Schema::new(vec![
            FieldDef {
                name: "code".into(),
                label: "Code".into(),
                field_type: FieldType::Text,
                required: true,
                searchable: Some(true),
                primary: true,
                renamed_from: None,
            },
            FieldDef {
                name: "definition".into(),
                label: "Definition".into(),
                field_type: FieldType::TextMultiline,
                required: false,
                searchable: None,
                primary: false,
                renamed_from: None,
            },
        ])
    }

    #[test]
    fn create_persists_kb_and_emits_event() {
        let (db, ev) = fresh();
        let mut rx = ev.subscribe();
        let repo = KbRepo::new(&db, &ev, Some("Sara".into()));
        let kb = repo
            .create(CreateKb {
                name: "Boeing".into(),
                description: Some("Boeing standards".into()),
                schema: boeing_schema(),
                highlight_color: "#f59e0b".into(),
            })
            .unwrap();
        assert_eq!(kb.primary_field, "code");
        let evt = rx.try_recv().unwrap();
        assert_eq!(evt, Event::KbCreated { kb_id: kb.id });
    }

    #[test]
    fn create_rejects_duplicate_name() {
        let (db, ev) = fresh();
        let repo = KbRepo::new(&db, &ev, None);
        repo.create(CreateKb {
            name: "Same".into(),
            description: None,
            schema: boeing_schema(),
            highlight_color: "#000".into(),
        })
        .unwrap();
        let err = repo
            .create(CreateKb {
                name: "Same".into(),
                description: None,
                schema: boeing_schema(),
                highlight_color: "#000".into(),
            })
            .unwrap_err();
        assert!(matches!(err, CoreError::Conflict(_)));
    }

    #[test]
    fn list_returns_alphabetical_order() {
        let (db, ev) = fresh();
        let repo = KbRepo::new(&db, &ev, None);
        for name in ["Charlie", "Alpha", "Bravo"] {
            repo.create(CreateKb {
                name: name.into(),
                description: None,
                schema: boeing_schema(),
                highlight_color: "#000".into(),
            })
            .unwrap();
        }
        let names: Vec<_> = repo.list().unwrap().into_iter().map(|k| k.name).collect();
        assert_eq!(names, vec!["Alpha", "Bravo", "Charlie"]);
    }

    #[test]
    fn update_meta_changes_color_and_updates_timestamp() {
        let (db, ev) = fresh();
        let repo = KbRepo::new(&db, &ev, None);
        let kb = repo
            .create(CreateKb {
                name: "X".into(),
                description: None,
                schema: boeing_schema(),
                highlight_color: "#000".into(),
            })
            .unwrap();
        let updated = repo
            .update_meta(
                kb.id,
                UpdateKbMeta {
                    highlight_color: Some("#f59e0b".into()),
                    ..Default::default()
                },
            )
            .unwrap();
        assert_eq!(updated.highlight_color, "#f59e0b");
        assert!(updated.updated_at >= kb.updated_at);
    }

    #[test]
    fn delete_removes_kb_and_cascades() {
        let (db, ev) = fresh();
        let repo = KbRepo::new(&db, &ev, None);
        let kb = repo
            .create(CreateKb {
                name: "Doomed".into(),
                description: None,
                schema: boeing_schema(),
                highlight_color: "#000".into(),
            })
            .unwrap();
        repo.delete(kb.id).unwrap();
        assert!(repo.find(kb.id).unwrap().is_none());
    }

    #[test]
    fn list_summaries_returns_entry_count_zero_for_new_kb() {
        let (db, ev) = fresh();
        let repo = KbRepo::new(&db, &ev, None);
        repo.create(CreateKb {
            name: "K".into(),
            description: None,
            schema: boeing_schema(),
            highlight_color: "#000".into(),
        })
        .unwrap();
        let summaries = repo.list_summaries().unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].entry_count, 0);
    }
}
