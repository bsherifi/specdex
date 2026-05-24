//! Schema migration executor (§15).
//!
//! All changes happen inside one `SQLite` transaction. On error, nothing is
//! persisted. Successful runs emit `KbSchemaChanged` and (if the primary
//! field changed) `ScanCacheInvalidated`.

use chrono::Utc;
use serde_json::{Map, Value};

use crate::db::Db;
use crate::events::EventBus;
use crate::models::event::Event;
use crate::models::ids::{KbId, SchemaHistoryId};
use crate::models::schema::{diff, FieldType, Schema, SchemaDiff};
use crate::{CoreError, Result};

#[derive(Debug, Clone)]
pub struct MigrateSchema {
    pub kb_id: KbId,
    pub new_schema: Schema,
    pub initiated_by: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MigrationReport {
    pub diff: SchemaDiff,
    pub entries_rewritten: usize,
    pub history_id: SchemaHistoryId,
}

pub fn migrate_schema(db: &Db, events: &EventBus, args: MigrateSchema) -> Result<MigrationReport> {
    args.new_schema
        .validate()
        .map_err(CoreError::SchemaValidation)?;
    let MigrateSchema {
        kb_id,
        new_schema,
        initiated_by,
    } = args;

    let report = db.with_mut(|conn| -> Result<MigrationReport> {
        let tx = conn.transaction()?;
        let (old_schema_json, old_primary): (String, String) = tx
            .query_row(
                "SELECT schema_json, primary_field FROM knowledge_bases WHERE id = ?1",
                [kb_id.to_string()],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => CoreError::NotFound(format!("kb={kb_id}")),
                other => other.into(),
            })?;

        let old_schema: Schema = serde_json::from_str(&old_schema_json)?;
        let d = diff(&old_schema, &new_schema);

        // Insert history row first — cheap insurance if anything below fails.
        let history_id = SchemaHistoryId::new();
        let now = Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_history
              (id, kb_id, previous_schema_json, previous_primary_field, diff_summary_json, migrated_at, migrated_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                history_id.to_string(),
                kb_id.to_string(),
                old_schema_json,
                old_primary,
                serde_json::to_string(&d)?,
                now,
                initiated_by,
            ],
        )?;

        // Rewrite entries.
        let entries_rewritten = rewrite_entries(&tx, kb_id, &d)?;

        // Update KB row.
        let new_schema_json = serde_json::to_string(&new_schema)?;
        let new_primary = new_schema.primary().expect("validated above").name.clone();
        let new_searchable = serde_json::to_string(&new_schema.searchable_field_names())?;
        tx.execute(
            "UPDATE knowledge_bases
             SET schema_json = ?1, primary_field = ?2, searchable_fields_json = ?3,
                 updated_at = ?4, edited_by = ?5
             WHERE id = ?6",
            rusqlite::params![
                new_schema_json,
                new_primary,
                new_searchable,
                now,
                initiated_by,
                kb_id.to_string(),
            ],
        )?;

        tx.commit()?;
        Ok(MigrationReport {
            diff: d,
            entries_rewritten,
            history_id,
        })
    })?;

    events.emit(Event::KbSchemaChanged { kb_id });
    if report.diff.requires_rescan() {
        events.emit(Event::ScanCacheInvalidated);
    }
    Ok(report)
}

fn rewrite_entries(tx: &rusqlite::Transaction<'_>, kb_id: KbId, d: &SchemaDiff) -> Result<usize> {
    let mut select = tx.prepare("SELECT id, data_json FROM entries WHERE kb_id = ?1")?;
    let entries: Vec<(String, String)> = select
        .query_map([kb_id.to_string()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    drop(select);

    let mut update =
        tx.prepare("UPDATE entries SET data_json = ?1, updated_at = ?2 WHERE id = ?3")?;
    let now = Utc::now().to_rfc3339();
    let mut count = 0usize;
    for (id, json) in entries {
        let mut data: Map<String, Value> = serde_json::from_str(&json)?;

        // Renames
        for (old_name, new_def) in &d.renamed {
            if let Some(v) = data.remove(old_name) {
                data.insert(new_def.name.clone(), v);
            }
        }

        // Removes → archive
        if !d.removed.is_empty() {
            let mut archived: Map<String, Value> = data
                .remove("_archived")
                .and_then(|v| serde_json::from_value(v).ok())
                .unwrap_or_default();
            for f in &d.removed {
                if let Some(v) = data.remove(&f.name) {
                    archived.insert(f.name.clone(), v);
                }
            }
            if !archived.is_empty() {
                data.insert("_archived".into(), Value::Object(archived));
            }
        }

        // Adds → null
        for f in &d.added {
            data.entry(f.name.clone()).or_insert(Value::Null);
        }

        // Type changes → best-effort coerce
        for (old, new) in &d.type_changed {
            let key = if old.name == new.name {
                old.name.clone()
            } else {
                continue;
            };
            if let Some(existing) = data.get(&key).cloned() {
                let coerced = coerce_value(&existing, &new.field_type);
                data.insert(key, coerced);
            }
        }

        let new_json = serde_json::to_string(&data)?;
        update.execute(rusqlite::params![new_json, now, id])?;
        count += 1;
    }
    Ok(count)
}

/// Best-effort type coercion. On failure → `Value::Null`. The §15 modal
/// warns the user before they confirm.
fn coerce_value(v: &Value, target: &FieldType) -> Value {
    match target {
        FieldType::Number => match v {
            Value::Number(_) => v.clone(),
            Value::String(s) => s
                .parse::<f64>()
                .ok()
                .and_then(serde_json::Number::from_f64)
                .map_or(Value::Null, Value::Number),
            _ => Value::Null,
        },
        FieldType::Date => match v {
            Value::String(s) => {
                if chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok() {
                    v.clone()
                } else {
                    Value::Null
                }
            }
            _ => Value::Null,
        },
        FieldType::Select { options } => match v {
            Value::String(s) if options.iter().any(|o| o == s) => v.clone(),
            _ => Value::Null,
        },
        FieldType::Text | FieldType::TextMultiline | FieldType::Url => match v {
            Value::String(_) => v.clone(),
            Value::Number(n) => Value::String(n.to_string()),
            Value::Bool(b) => Value::String(b.to_string()),
            Value::Null => Value::Null,
            other => Value::String(other.to_string()),
        },
        FieldType::ImageAttachment => match v {
            Value::String(_) => v.clone(),
            _ => Value::Null,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kb::{CreateKb, KbRepo};
    use crate::models::schema::FieldDef;

    fn primary(name: &str) -> FieldDef {
        FieldDef {
            name: name.into(),
            label: name.to_uppercase(),
            field_type: FieldType::Text,
            required: true,
            searchable: Some(true),
            primary: true,
            renamed_from: None,
        }
    }

    fn text(name: &str) -> FieldDef {
        FieldDef {
            name: name.into(),
            label: name.to_uppercase(),
            field_type: FieldType::Text,
            required: false,
            searchable: None,
            primary: false,
            renamed_from: None,
        }
    }

    fn seed_kb(db: &Db, ev: &EventBus, fields: Vec<FieldDef>) -> KbId {
        let repo = KbRepo::new(db, ev, None);
        repo.create(CreateKb {
            name: "k".into(),
            description: None,
            schema: Schema::new(fields),
            highlight_color: "#000".into(),
        })
        .unwrap()
        .id
    }

    fn insert_raw_entry(db: &Db, kb_id: KbId, data: &Value) {
        db.with_mut(|conn| {
            let now = Utc::now().to_rfc3339();
            conn.execute(
                "INSERT INTO entries (id, kb_id, primary_value, data_json, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                rusqlite::params![
                    crate::models::ids::EntryId::new().to_string(),
                    kb_id.to_string(),
                    "x",
                    serde_json::to_string(data).unwrap(),
                    now,
                ],
            )?;
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn rename_preserves_data() {
        let db = Db::open_memory().unwrap();
        let ev = EventBus::new();
        let kb_id = seed_kb(&db, &ev, vec![primary("code"), text("notes")]);
        insert_raw_entry(
            &db,
            kb_id,
            &serde_json::json!({"code": "BAC", "notes": "hello"}),
        );

        let new_schema = Schema::new(vec![
            primary("code"),
            FieldDef {
                renamed_from: Some("notes".into()),
                ..text("comments")
            },
        ]);
        let rpt = migrate_schema(
            &db,
            &ev,
            MigrateSchema {
                kb_id,
                new_schema,
                initiated_by: None,
            },
        )
        .unwrap();
        assert_eq!(rpt.entries_rewritten, 1);
        let json = db
            .with(|c| {
                let s: String = c.query_row(
                    "SELECT data_json FROM entries WHERE kb_id = ?1",
                    [kb_id.to_string()],
                    |row| row.get(0),
                )?;
                Ok(s)
            })
            .unwrap();
        let m: Map<String, Value> = serde_json::from_str(&json).unwrap();
        assert_eq!(m.get("comments").unwrap(), "hello");
        assert!(m.get("notes").is_none());
    }

    #[test]
    fn remove_archives_under_underscore_archived() {
        let db = Db::open_memory().unwrap();
        let ev = EventBus::new();
        let kb_id = seed_kb(&db, &ev, vec![primary("code"), text("legacy")]);
        insert_raw_entry(
            &db,
            kb_id,
            &serde_json::json!({"code": "BAC", "legacy": "x"}),
        );

        let new_schema = Schema::new(vec![primary("code")]);
        migrate_schema(
            &db,
            &ev,
            MigrateSchema {
                kb_id,
                new_schema,
                initiated_by: None,
            },
        )
        .unwrap();
        let json = db
            .with(|c| {
                let s: String = c.query_row(
                    "SELECT data_json FROM entries WHERE kb_id = ?1",
                    [kb_id.to_string()],
                    |row| row.get(0),
                )?;
                Ok(s)
            })
            .unwrap();
        assert!(json.contains("_archived"));
        assert!(json.contains("legacy"));
    }

    #[test]
    fn type_change_text_to_number_coerces_or_nulls() {
        let db = Db::open_memory().unwrap();
        let ev = EventBus::new();
        let kb_id = seed_kb(&db, &ev, vec![primary("code"), text("qty")]);
        insert_raw_entry(&db, kb_id, &serde_json::json!({"code": "BAC", "qty": "42"}));
        insert_raw_entry(
            &db,
            kb_id,
            &serde_json::json!({"code": "BAD", "qty": "nope"}),
        );

        let mut new_qty = text("qty");
        new_qty.field_type = FieldType::Number;
        let new_schema = Schema::new(vec![primary("code"), new_qty]);
        migrate_schema(
            &db,
            &ev,
            MigrateSchema {
                kb_id,
                new_schema,
                initiated_by: None,
            },
        )
        .unwrap();

        let rows = db
            .with(|c| {
                let mut stmt = c.prepare("SELECT data_json FROM entries WHERE kb_id = ?1")?;
                let v: Vec<String> = stmt
                    .query_map([kb_id.to_string()], |row| row.get::<_, String>(0))?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(v)
            })
            .unwrap();

        let mut found_42 = false;
        let mut found_null = false;
        for r in rows {
            let m: Value = serde_json::from_str(&r).unwrap();
            match m.get("qty") {
                Some(Value::Number(n)) if n.as_f64() == Some(42.0) => found_42 = true,
                Some(Value::Null) | None => found_null = true,
                _ => {}
            }
        }
        assert!(found_42 && found_null);
    }

    #[test]
    fn schema_history_records_diff() {
        let db = Db::open_memory().unwrap();
        let ev = EventBus::new();
        let kb_id = seed_kb(&db, &ev, vec![primary("code")]);
        migrate_schema(
            &db,
            &ev,
            MigrateSchema {
                kb_id,
                new_schema: Schema::new(vec![primary("code"), text("added")]),
                initiated_by: Some("Sara".into()),
            },
        )
        .unwrap();
        let count: i64 = db
            .with(|c| {
                Ok(c.query_row(
                    "SELECT count(*) FROM schema_history WHERE kb_id = ?1",
                    [kb_id.to_string()],
                    |row| row.get(0),
                )?)
            })
            .unwrap();
        assert_eq!(count, 1);
    }
}
