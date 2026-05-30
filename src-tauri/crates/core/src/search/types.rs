//! Shared search-result types. Returned to adapters and to the frontend
//! via specta.

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::models::ids::{EntryId, KbId, SourceDocId};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EntryHit {
    pub entry_id: EntryId,
    pub kb_id: KbId,
    pub kb_name: String,
    pub primary_value: String,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SourceDocHit {
    pub source_doc_id: SourceDocId,
    pub filename: String,
    pub snippet_html: String,
    pub score: f32,
}
