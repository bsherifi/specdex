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
    // create / find / get / list / update / delete / bulk_delete land in
    // tasks 3–7 inside this same impl block.
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
}
