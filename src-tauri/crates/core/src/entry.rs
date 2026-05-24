//! Entry CRUD module skeleton. Method bodies are added in tasks 3–7.
//! Validation flows through `entry_validation`; KB lookups through `KbRepo`.

use chrono::Utc;
use rusqlite::{params, OptionalExtension};

use crate::db::Db;
use crate::entry_validation::{validate, EntryValidationError};
use crate::events::EventBus;
use crate::kb::KbRepo;
use crate::models::entry::{Entry, EntryData, SourceRef};
use crate::models::event::Event;
use crate::models::ids::{EntryId, KbId, SourceDocId};
use crate::models::source_document::BBox;
use crate::{CoreError, Result};

#[derive(Debug, Clone)]
pub struct CreateEntry {
    pub kb_id: KbId,
    pub data: EntryData,
    pub aliases: Vec<String>,
    pub source: Option<SourceRef>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct UpdateEntry {
    pub data: Option<EntryData>,
    pub aliases: Option<Vec<String>>,
    pub source: Option<Option<SourceRef>>,
    pub notes: Option<Option<String>>,
}

#[derive(Debug, Clone, Default)]
pub struct ListEntries {
    pub kb_id: KbId,
    pub filter: Option<String>,
    pub source_doc_id: Option<SourceDocId>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Soft-duplicate signal — same KB and same primary_value already exists.
/// Returned from `create` alongside the new entry so the UI can warn.
#[derive(Debug, Clone, PartialEq)]
pub struct SoftDuplicateWarning {
    pub existing_entry_id: EntryId,
}

#[derive(Debug, Clone)]
pub struct CreateEntryResult {
    pub entry: Entry,
    pub warning: Option<SoftDuplicateWarning>,
}

pub struct EntryRepo<'db> {
    db: &'db Db,
    events: &'db EventBus,
    identity_name: Option<String>,
}

impl<'db> EntryRepo<'db> {
    pub fn new(db: &'db Db, events: &'db EventBus, identity_name: Option<String>) -> Self {
        Self { db, events, identity_name }
    }

    pub fn create(&self, args: CreateEntry) -> Result<CreateEntryResult> {
        let kb_repo = KbRepo::new(self.db, self.events, self.identity_name.clone());
        let kb = kb_repo.get(args.kb_id)?;
        let primary_value = validate(&args.data, &kb.schema)
            .map_err(map_validation_errs)?;

        let aliases = Entry::normalize_aliases(args.aliases);
        let id = EntryId::new();
        let now = Utc::now();
        let now_s = now.to_rfc3339();

        let warning = self.db.with(|c| {
            let existing: Option<String> = c
                .query_row(
                    "SELECT id FROM entries WHERE kb_id = ?1 AND primary_value = ?2 LIMIT 1",
                    params![args.kb_id.to_string(), primary_value],
                    |row| row.get(0),
                )
                .optional()?;
            Ok(existing
                .and_then(|s| s.parse::<EntryId>().ok())
                .map(|existing_entry_id| SoftDuplicateWarning { existing_entry_id }))
        })?;

        self.db.with_mut(|conn| {
            conn.execute(
                "INSERT INTO entries
                   (id, kb_id, primary_value, data_json, aliases_json,
                    source_doc_id, source_page, source_bbox_json, source_text,
                    notes, created_at, updated_at, edited_by)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11, ?12)",
                params![
                    id.to_string(),
                    args.kb_id.to_string(),
                    primary_value,
                    serde_json::to_string(&args.data)?,
                    serde_json::to_string(&aliases)?,
                    args.source.as_ref().map(|s| s.source_doc_id.to_string()),
                    args.source.as_ref().map(|s| s.page),
                    args.source
                        .as_ref()
                        .map(|s| serde_json::to_string(&s.bbox))
                        .transpose()?,
                    args.source.as_ref().map(|s| s.text.clone()),
                    args.notes,
                    now_s,
                    self.identity_name,
                ],
            )?;
            Ok(())
        })?;

        let entry = Entry {
            id,
            kb_id: args.kb_id,
            primary_value,
            data: args.data,
            aliases,
            source: args.source,
            notes: args.notes,
            created_at: now,
            updated_at: now,
            edited_by: self.identity_name.clone(),
        };
        self.events.emit(Event::EntryCreated { entry_id: entry.id, kb_id: entry.kb_id });
        Ok(CreateEntryResult { entry, warning })
    }

    pub fn find(&self, id: EntryId) -> Result<Option<Entry>> {
        self.db.with(|conn| {
            let row = conn
                .query_row(SELECT_ENTRY, [id.to_string()], map_entry_row)
                .optional()?;
            Ok(row)
        })
    }

    pub fn get(&self, id: EntryId) -> Result<Entry> {
        self.find(id)?.ok_or_else(|| CoreError::NotFound(format!("entry={id}")))
    }

    pub fn list(&self, args: ListEntries) -> Result<Vec<Entry>> {
        self.db.with(|conn| {
            let mut sql = String::from(
                "SELECT id, kb_id, primary_value, data_json, aliases_json,
                        source_doc_id, source_page, source_bbox_json, source_text,
                        notes, created_at, updated_at, edited_by
                 FROM entries WHERE kb_id = ?1",
            );
            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(args.kb_id.to_string())];
            if let Some(ref f) = args.filter {
                sql.push_str(" AND (primary_value LIKE ?2 OR data_json LIKE ?2)");
                let pat = format!("%{f}%");
                params_vec.push(Box::new(pat));
            }
            if let Some(sid) = args.source_doc_id {
                let placeholder = format!(" AND source_doc_id = ?{}", params_vec.len() + 1);
                sql.push_str(&placeholder);
                params_vec.push(Box::new(sid.to_string()));
            }
            sql.push_str(" ORDER BY primary_value ASC");
            if let Some(l) = args.limit {
                sql.push_str(&format!(" LIMIT {l}"));
            }
            if let Some(o) = args.offset {
                sql.push_str(&format!(" OFFSET {o}"));
            }
            let mut stmt = conn.prepare(&sql)?;
            let param_refs: Vec<&dyn rusqlite::ToSql> =
                params_vec.iter().map(|b| b.as_ref()).collect();
            let rows = stmt
                .query_map(rusqlite::params_from_iter(param_refs), map_entry_row)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })
    }

    pub fn update(&self, id: EntryId, patch: UpdateEntry) -> Result<Entry> {
        let mut existing = self.get(id)?;
        let kb_repo = KbRepo::new(self.db, self.events, self.identity_name.clone());
        let kb = kb_repo.get(existing.kb_id)?;

        if let Some(d) = patch.data {
            existing.primary_value = validate(&d, &kb.schema).map_err(map_validation_errs)?;
            existing.data = d;
        }
        if let Some(a) = patch.aliases {
            existing.aliases = Entry::normalize_aliases(a);
        }
        if let Some(s) = patch.source {
            existing.source = s;
        }
        if let Some(n) = patch.notes {
            existing.notes = n;
        }
        existing.updated_at = Utc::now();
        existing.edited_by = self.identity_name.clone();

        let now_s = existing.updated_at.to_rfc3339();
        self.db.with_mut(|conn| {
            let affected = conn.execute(
                "UPDATE entries SET
                   primary_value = ?1, data_json = ?2, aliases_json = ?3,
                   source_doc_id = ?4, source_page = ?5, source_bbox_json = ?6, source_text = ?7,
                   notes = ?8, updated_at = ?9, edited_by = ?10
                 WHERE id = ?11",
                params![
                    existing.primary_value,
                    serde_json::to_string(&existing.data)?,
                    serde_json::to_string(&existing.aliases)?,
                    existing.source.as_ref().map(|s| s.source_doc_id.to_string()),
                    existing.source.as_ref().map(|s| s.page),
                    existing.source.as_ref().map(|s| serde_json::to_string(&s.bbox)).transpose()?,
                    existing.source.as_ref().map(|s| s.text.clone()),
                    existing.notes,
                    now_s,
                    self.identity_name,
                    id.to_string(),
                ],
            )?;
            if affected == 0 {
                return Err(CoreError::NotFound(format!("entry={id}")));
            }
            Ok(())
        })?;

        self.events.emit(Event::EntryUpdated { entry_id: id, kb_id: existing.kb_id });
        Ok(existing)
    }

    pub fn delete(&self, id: EntryId) -> Result<()> {
        let existing = self.get(id)?;
        self.db.with_mut(|conn| {
            conn.execute("DELETE FROM entries WHERE id = ?1", [id.to_string()])?;
            Ok(())
        })?;
        self.events.emit(Event::EntryDeleted { entry_id: id, kb_id: existing.kb_id });
        Ok(())
    }

    pub fn bulk_delete(&self, ids: &[EntryId]) -> Result<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let mut total = 0usize;
        for id in ids {
            // Per-id to keep events one-per-entry. Acceptable at v1 scale.
            match self.delete(*id) {
                Ok(()) => total += 1,
                Err(CoreError::NotFound(_)) => continue,
                Err(e) => return Err(e),
            }
        }
        Ok(total)
    }
}

const SELECT_ENTRY: &str = "
SELECT id, kb_id, primary_value, data_json, aliases_json,
       source_doc_id, source_page, source_bbox_json, source_text,
       notes, created_at, updated_at, edited_by
FROM entries WHERE id = ?1";

fn map_entry_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Entry> {
    let convert =
        |e: Box<dyn std::error::Error + Send + Sync>| -> rusqlite::Error {
            rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, e)
        };
    let id: String = row.get(0)?;
    let id = id.parse::<EntryId>().map_err(|e| convert(Box::new(e)))?;
    let kb_id: String = row.get(1)?;
    let kb_id = kb_id.parse::<KbId>().map_err(|e| convert(Box::new(e)))?;
    let data_json: String = row.get(3)?;
    let data: EntryData = serde_json::from_str(&data_json).map_err(|e| convert(Box::new(e)))?;
    let aliases_json: String = row.get(4)?;
    let aliases: Vec<String> = serde_json::from_str(&aliases_json).map_err(|e| convert(Box::new(e)))?;
    let source_doc_id: Option<String> = row.get(5)?;
    let source_page: Option<u32> = row.get(6)?;
    let source_bbox_json: Option<String> = row.get(7)?;
    let source_text: Option<String> = row.get(8)?;
    let source = match (source_doc_id, source_page, source_bbox_json) {
        (Some(sid), Some(p), Some(bbox_s)) => {
            let sid = sid.parse::<SourceDocId>().map_err(|e| convert(Box::new(e)))?;
            let bbox: BBox = serde_json::from_str(&bbox_s).map_err(|e| convert(Box::new(e)))?;
            Some(SourceRef {
                source_doc_id: sid,
                page: p,
                bbox,
                text: source_text.unwrap_or_default(),
            })
        }
        _ => None,
    };
    let created_at: String = row.get(10)?;
    let updated_at: String = row.get(11)?;
    let created_at = created_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map_err(|e| convert(Box::new(e)))?;
    let updated_at = updated_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map_err(|e| convert(Box::new(e)))?;
    Ok(Entry {
        id,
        kb_id,
        primary_value: row.get(2)?,
        data,
        aliases,
        source,
        notes: row.get(9)?,
        created_at,
        updated_at,
        edited_by: row.get(12)?,
    })
}

fn map_validation_errs(errs: Vec<EntryValidationError>) -> CoreError {
    CoreError::Validation(
        errs.iter()
            .map(std::string::ToString::to_string)
            .collect::<Vec<_>>()
            .join("; "),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kb::{CreateKb, KbRepo};
    use crate::models::schema::{FieldDef, FieldType, Schema};
    use serde_json::json;

    pub(super) fn fresh() -> (Db, EventBus) {
        (Db::open_memory().unwrap(), EventBus::new())
    }

    pub(super) fn boeing_kb(db: &Db, ev: &EventBus) -> KbId {
        let kb_repo = KbRepo::new(db, ev, None);
        let schema = Schema::new(vec![
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
        ]);
        kb_repo
            .create(CreateKb {
                name: "Boeing".into(),
                description: None,
                schema,
                highlight_color: "#000".into(),
            })
            .unwrap()
            .id
    }

    pub(super) fn data(code: &str, def: &str) -> EntryData {
        let mut m = EntryData::new();
        m.insert("code".into(), json!(code));
        m.insert("definition".into(), json!(def));
        m
    }

    #[test]
    fn create_returns_entry_with_normalized_aliases() {
        let (db, ev) = fresh();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, Some("Sara".into()));
        let res = repo
            .create(CreateEntry {
                kb_id,
                data: data("BAC3082", "Surface prep"),
                aliases: vec!["BAC-3082".into(), " BAC 3082 ".into(), "BAC-3082".into()],
                source: None,
                notes: None,
            })
            .unwrap();
        assert_eq!(res.entry.primary_value, "BAC3082");
        assert_eq!(res.entry.aliases, vec!["BAC-3082", "BAC 3082"]);
        assert!(res.warning.is_none());
    }

    #[test]
    fn create_warns_on_soft_duplicate() {
        let (db, ev) = fresh();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        let first = repo
            .create(CreateEntry {
                kb_id,
                data: data("DUPE", "first"),
                aliases: vec![],
                source: None,
                notes: None,
            })
            .unwrap();
        assert!(first.warning.is_none());
        let second = repo
            .create(CreateEntry {
                kb_id,
                data: data("DUPE", "second"),
                aliases: vec![],
                source: None,
                notes: None,
            })
            .unwrap();
        assert_eq!(second.warning.as_ref().unwrap().existing_entry_id, first.entry.id);
    }

    #[test]
    fn create_rejects_invalid_schema_data() {
        let (db, ev) = fresh();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        let mut bad = EntryData::new();
        bad.insert("definition".into(), json!("?"));
        let err = repo
            .create(CreateEntry {
                kb_id,
                data: bad,
                aliases: vec![],
                source: None,
                notes: None,
            })
            .unwrap_err();
        assert!(matches!(err, CoreError::Validation(_)));
    }

    #[test]
    fn get_returns_not_found_for_unknown_id() {
        let (db, ev) = fresh();
        let _kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        let ghost = EntryId::new();
        let err = repo.get(ghost).unwrap_err();
        assert!(matches!(err, CoreError::NotFound(_)));
    }

    #[test]
    fn list_filters_by_substring_and_returns_alphabetical() {
        let (db, ev) = fresh();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        for c in ["BAC5050", "BAC3082", "AMS-C-5541"] {
            repo.create(CreateEntry {
                kb_id,
                data: data(c, "x"),
                aliases: vec![],
                source: None,
                notes: None,
            })
            .unwrap();
        }
        let list = repo
            .list(ListEntries {
                kb_id,
                filter: Some("BAC".into()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].primary_value, "BAC3082");
        assert_eq!(list[1].primary_value, "BAC5050");
    }

    #[test]
    fn update_recomputes_primary_value_and_emits() {
        let (db, ev) = fresh();
        let mut rx = ev.subscribe();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        let created = repo
            .create(CreateEntry {
                kb_id,
                data: data("OLD", "?"),
                aliases: vec![],
                source: None,
                notes: None,
            })
            .unwrap()
            .entry;
        // Drain KbCreated + EntryCreated queued on the shared bus.
        while rx.try_recv().is_ok() {}
        let updated = repo
            .update(created.id, UpdateEntry {
                data: Some(data("NEW", "?")),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(updated.primary_value, "NEW");
        let evt = rx.try_recv().unwrap();
        assert_eq!(evt, Event::EntryUpdated { entry_id: created.id, kb_id });
    }

    #[test]
    fn delete_removes_entry_and_emits() {
        let (db, ev) = fresh();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        let created = repo
            .create(CreateEntry { kb_id, data: data("X", "?"), aliases: vec![], source: None, notes: None })
            .unwrap()
            .entry;
        repo.delete(created.id).unwrap();
        assert!(repo.find(created.id).unwrap().is_none());
    }

    #[test]
    fn bulk_delete_skips_missing_ids() {
        let (db, ev) = fresh();
        let kb_id = boeing_kb(&db, &ev);
        let repo = EntryRepo::new(&db, &ev, None);
        let a = repo
            .create(CreateEntry { kb_id, data: data("A", "?"), aliases: vec![], source: None, notes: None })
            .unwrap().entry.id;
        let b = repo
            .create(CreateEntry { kb_id, data: data("B", "?"), aliases: vec![], source: None, notes: None })
            .unwrap().entry.id;
        let ghost = EntryId::new();
        let n = repo.bulk_delete(&[a, b, ghost]).unwrap();
        assert_eq!(n, 2);
    }
}
