//! Scanner output types (§13).

use serde::{Deserialize, Serialize};
use specta::Type;

use super::ids::{EntryId, KbId};
use super::source_document::BBox;

/// Which KBs participate in scanning. Controlled by the document viewer's
/// KB-scope dropdown (§7.3). v1 is single-select per §13.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScanScope {
    All,
    Only { kb_id: KbId },
}

impl ScanScope {
    #[must_use]
    pub fn includes_kb(&self, kb_id: KbId) -> bool {
        match self {
            ScanScope::All => true,
            ScanScope::Only { kb_id: k } => *k == kb_id,
        }
    }
}

/// Whether the matched pattern is the entry's primary value or one of its
/// aliases. Used by the viewer's hover card to label the match source.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum PatternSource {
    Primary,
    Alias,
}

/// One scanner hit. Page-and-bbox located via §13's offset→span resolver.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Match {
    pub entry_id: EntryId,
    pub kb_id: KbId,
    pub pattern_source: PatternSource,
    pub matched_text: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub page: u32,
    pub bbox: BBox,
}

/// A literal substring hit inside a document's parsed text, page-located via
/// the offset→span resolver. Powers find-in-document (⌘F) in the viewer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct FindMatch {
    pub page: u32,
    pub bbox: BBox,
    /// A short surrounding snippet for the find bar (form-feeds flattened).
    pub context: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scope_all_includes_any_kb() {
        let any = KbId::new();
        assert!(ScanScope::All.includes_kb(any));
    }

    #[test]
    fn scope_only_includes_only_that_kb() {
        let a = KbId::new();
        let b = KbId::new();
        let s = ScanScope::Only { kb_id: a };
        assert!(s.includes_kb(a));
        assert!(!s.includes_kb(b));
    }
}
