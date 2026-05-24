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
}
