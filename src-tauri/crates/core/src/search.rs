//! Tantivy full-text search. §14.

pub mod entries_index;
pub mod source_docs_index;
pub mod types;

pub use entries_index::EntriesIndex;
pub use source_docs_index::SourceDocsIndex;
pub use types::{EntryHit, SourceDocHit};

use std::path::Path;
use std::sync::Arc;

use crate::Result;

/// Top-level `Search` — owns both indexes.
pub struct Search {
    pub entries: Arc<EntriesIndex>,
    pub source_docs: Arc<SourceDocsIndex>,
}

impl Search {
    pub fn open(tantivy_root: &Path) -> Result<Self> {
        let entries = Arc::new(EntriesIndex::open(&tantivy_root.join("entries"))?);
        let source_docs = Arc::new(SourceDocsIndex::open(&tantivy_root.join("source_docs"))?);
        Ok(Self {
            entries,
            source_docs,
        })
    }
}

/// Backslash-escapes every character the Tantivy query grammar treats as an
/// operator, so a user's literal text (e.g. a spec code like `BAC-3082`, where
/// `-` would otherwise mean "must not contain") is matched as plain terms.
/// Tantivy 0.22 dropped the `QueryParser::escape` helper, so we provide our own.
pub(crate) fn escape_query(query: &str) -> String {
    const SPECIAL: &[char] = &[
        '\\', '+', '-', '!', '(', ')', ':', '^', '[', ']', '"', '{', '}', '~', '*', '?', '/', '&',
        '|',
    ];
    let mut out = String::with_capacity(query.len() + 8);
    for c in query.chars() {
        if SPECIAL.contains(&c) {
            out.push('\\');
        }
        out.push(c);
    }
    out
}
