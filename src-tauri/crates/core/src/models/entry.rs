//! Entry + source back-reference + entry data shape.
//!
//! Implements §11.1 (`entries`) and §11.4 (source back-ref).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::ids::{EntryId, KbId, SourceDocId};
use super::source_document::BBox;

/// Entry payload — JSON object whose keys correspond to schema field names.
/// Stored verbatim as `data_json`; validated against the KB's schema before insert/update.
pub type EntryData = serde_json::Map<String, serde_json::Value>;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct SourceRef {
    pub source_doc_id: SourceDocId,
    pub page: u32,
    pub bbox: BBox,
    /// Selected text + ~200 chars of surrounding context. Displayed verbatim
    /// on the entry editor so the user knows where the entry came from.
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Entry {
    pub id: EntryId,
    pub kb_id: KbId,
    pub primary_value: String,
    pub data: EntryData,
    pub aliases: Vec<String>,
    pub source: Option<SourceRef>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub edited_by: Option<String>,
}

impl Entry {
    /// Trims, dedups, and drops empty aliases. Called from entry CRUD before
    /// persisting.
    pub fn normalize_aliases(aliases: Vec<String>) -> Vec<String> {
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::with_capacity(aliases.len());
        for a in aliases {
            let trimmed = a.trim();
            if trimmed.is_empty() {
                continue;
            }
            if seen.insert(trimmed.to_owned()) {
                out.push(trimmed.to_owned());
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalize_aliases_trims_and_dedups() {
        let raw = vec![
            "BAC-5050".into(),
            "  BAC 5050  ".into(),
            "BAC-5050".into(),
            String::new(),
            " ".into(),
        ];
        let normalized = Entry::normalize_aliases(raw);
        assert_eq!(normalized, vec!["BAC-5050", "BAC 5050"]);
    }

    #[test]
    fn entry_round_trips_through_json() {
        let e = Entry {
            id: EntryId::new(),
            kb_id: KbId::new(),
            primary_value: "BAC3082".into(),
            data: {
                let mut m = serde_json::Map::new();
                m.insert("code".into(), json!("BAC3082"));
                m.insert("definition".into(), json!("…"));
                m
            },
            aliases: vec!["BAC-3082".into()],
            source: Some(SourceRef {
                source_doc_id: SourceDocId::new(),
                page: 3,
                bbox: BBox::new(10.0, 10.0, 100.0, 20.0),
                text: "BAC3082 — Surface preparation…".into(),
            }),
            notes: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            edited_by: Some("Sara".into()),
        };
        let s = serde_json::to_string(&e).unwrap();
        let back: Entry = serde_json::from_str(&s).unwrap();
        assert_eq!(back.primary_value, "BAC3082");
        assert_eq!(back.aliases, vec!["BAC-3082"]);
        assert!(back.source.is_some());
    }
}
