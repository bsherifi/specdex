//! Aho-Corasick automaton + per-pattern metadata.

use std::collections::HashSet;

use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};

use crate::db::Db;
use crate::models::ids::{EntryId, KbId};
use crate::models::scan::{Match, PatternSource as ModelPatternSource, ScanScope};
use crate::models::source_document::SourceDocument;
use crate::scanner::resolver::resolve_location;
use crate::{CoreError, Result};

#[derive(Debug, Clone)]
pub struct PatternMeta {
    pub entry_id: EntryId,
    pub kb_id: KbId,
    pub source: PatternSource,
}

#[derive(Debug, Clone, Copy)]
pub enum PatternSource {
    Primary,
    Alias,
}

impl From<PatternSource> for ModelPatternSource {
    fn from(s: PatternSource) -> Self {
        match s {
            PatternSource::Primary => Self::Primary,
            PatternSource::Alias => Self::Alias,
        }
    }
}

pub struct ScanIndex {
    automaton: AhoCorasick,
    patterns: Vec<PatternMeta>,
}

impl ScanIndex {
    fn build_from_rows(rows: Vec<(String, String, String, String)>) -> Result<Self> {
        let convert = |e: Box<dyn std::error::Error + Send + Sync>| -> CoreError {
            CoreError::Db(e.to_string())
        };
        let mut patterns: Vec<PatternMeta> = Vec::new();
        let mut strings: Vec<String> = Vec::new();
        for (entry_id, kb_id, primary_value, aliases_json) in rows {
            let entry_id = entry_id
                .parse::<EntryId>()
                .map_err(|e| convert(Box::new(e)))?;
            let kb_id = kb_id.parse::<KbId>().map_err(|e| convert(Box::new(e)))?;
            let aliases: Vec<String> = serde_json::from_str(&aliases_json)?;

            // Dedup primary_value against aliases within the same entry.
            let mut seen: HashSet<String> = HashSet::new();
            if seen.insert(primary_value.clone()) {
                patterns.push(PatternMeta {
                    entry_id,
                    kb_id,
                    source: PatternSource::Primary,
                });
                strings.push(primary_value);
            }
            for a in aliases {
                if seen.insert(a.clone()) {
                    patterns.push(PatternMeta {
                        entry_id,
                        kb_id,
                        source: PatternSource::Alias,
                    });
                    strings.push(a);
                }
            }
        }

        // Empty automatons are awkward in aho-corasick; build a no-op marker.
        let automaton = if strings.is_empty() {
            AhoCorasickBuilder::new()
                .match_kind(MatchKind::LeftmostLongest)
                .build(["\u{0000}"])
                .map_err(|e| CoreError::Internal(e.to_string()))?
        } else {
            AhoCorasickBuilder::new()
                .match_kind(MatchKind::LeftmostLongest)
                .build(strings)
                .map_err(|e| CoreError::Internal(e.to_string()))?
        };

        Ok(Self {
            automaton,
            patterns,
        })
    }

    pub fn build_from_db(db: &Db) -> Result<Self> {
        let rows: Vec<(String, String, String, String)> = db.with(|conn| {
            let mut stmt =
                conn.prepare("SELECT id, kb_id, primary_value, aliases_json FROM entries")?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                    ))
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })?;

        Self::build_from_rows(rows)
    }

    pub fn scan(&self, doc: &SourceDocument, scope: &ScanScope) -> Vec<Match> {
        if self.patterns.is_empty() {
            return Vec::new();
        }
        let mut out = Vec::new();
        for m in self.automaton.find_iter(&doc.parsed_text) {
            let pid = m.pattern().as_usize();
            // Guard against the no-op marker case.
            let Some(meta) = self.patterns.get(pid) else {
                continue;
            };
            if !scope.includes_kb(meta.kb_id) {
                continue;
            }
            let (page, bbox) = resolve_location(doc, m.start(), m.end());
            out.push(Match {
                entry_id: meta.entry_id,
                kb_id: meta.kb_id,
                pattern_source: meta.source.into(),
                matched_text: doc.parsed_text[m.start()..m.end()].to_string(),
                start_offset: m.start(),
                end_offset: m.end(),
                page,
                bbox,
            });
        }
        out
    }

    #[must_use]
    pub fn pattern_count(&self) -> usize {
        self.patterns.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ids::{EntryId, KbId, SourceDocId};
    use crate::models::source_document::{BBox, SourceDocument, TextSpan};

    pub(super) fn make_doc(text: &str, spans: Vec<TextSpan>) -> SourceDocument {
        SourceDocument {
            id: SourceDocId::new(),
            filename: "x.pdf".into(),
            stored_path: "docs/x.pdf".into(),
            content_sha256: "0".repeat(64),
            mime_type: "application/pdf".into(),
            page_count: 1,
            parsed_text: text.to_string(),
            parsed_spans: spans,
            ocr_used: false,
            ingested_at: chrono::Utc::now(),
            ingested_by: None,
        }
    }

    #[test]
    fn build_from_rows_collects_primary_and_aliases() {
        let e1 = EntryId::new();
        let kb = KbId::new();
        let rows = vec![(
            e1.to_string(),
            kb.to_string(),
            "BAC3082".into(),
            serde_json::to_string(&vec!["BAC-3082"]).unwrap(),
        )];
        let index = ScanIndex::build_from_rows(rows).unwrap();
        assert_eq!(index.pattern_count(), 2);
    }

    #[test]
    fn finds_primary_and_alias_hits() {
        let e1 = EntryId::new();
        let kb = KbId::new();
        let rows = vec![(
            e1.to_string(),
            kb.to_string(),
            "BAC3082".into(),
            serde_json::to_string(&vec!["BAC-3082"]).unwrap(),
        )];
        let index = ScanIndex::build_from_rows(rows).unwrap();
        let text = "Use BAC3082 and BAC-3082 in this doc.";
        let doc = make_doc(
            text,
            vec![TextSpan {
                start_offset: 0,
                end_offset: text.len(),
                page: 1,
                bbox: BBox::new(0.0, 0.0, 100.0, 12.0),
            }],
        );
        let m = index.scan(&doc, &ScanScope::All);
        assert_eq!(m.len(), 2);
        assert_eq!(m[0].matched_text, "BAC3082");
        assert_eq!(m[1].matched_text, "BAC-3082");
    }

    #[test]
    fn leftmost_longest_prefers_longer_alias() {
        let e1 = EntryId::new();
        let kb = KbId::new();
        let rows = vec![(
            e1.to_string(),
            kb.to_string(),
            "BAC5050".into(),
            serde_json::to_string(&vec!["BAC5050 Rev D"]).unwrap(),
        )];
        let index = ScanIndex::build_from_rows(rows).unwrap();
        let text = "use BAC5050 Rev D in this doc";
        let doc = make_doc(
            text,
            vec![TextSpan {
                start_offset: 0,
                end_offset: text.len(),
                page: 1,
                bbox: BBox::new(0.0, 0.0, 100.0, 12.0),
            }],
        );
        let m = index.scan(&doc, &ScanScope::All);
        assert_eq!(m.len(), 1);
        assert_eq!(m[0].matched_text, "BAC5050 Rev D");
    }

    #[test]
    fn scope_only_filters_other_kbs() {
        let e1 = EntryId::new();
        let e2 = EntryId::new();
        let kb_a = KbId::new();
        let kb_b = KbId::new();
        let rows = vec![
            (e1.to_string(), kb_a.to_string(), "AAA".into(), "[]".into()),
            (e2.to_string(), kb_b.to_string(), "BBB".into(), "[]".into()),
        ];
        let index = ScanIndex::build_from_rows(rows).unwrap();
        let text = "AAA BBB AAA";
        let doc = make_doc(
            text,
            vec![TextSpan {
                start_offset: 0,
                end_offset: text.len(),
                page: 1,
                bbox: BBox::new(0.0, 0.0, 100.0, 12.0),
            }],
        );
        let hits = index.scan(&doc, &ScanScope::Only { kb_id: kb_a });
        assert!(hits.iter().all(|m| m.kb_id == kb_a));
        assert_eq!(hits.len(), 2);
    }

    #[test]
    fn empty_db_produces_no_hits() {
        let index = ScanIndex::build_from_rows(vec![]).unwrap();
        let doc = make_doc("nothing to find", vec![]);
        assert!(index.scan(&doc, &ScanScope::All).is_empty());
    }
}
