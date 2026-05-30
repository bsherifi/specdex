//! Resolves a byte-offset range to `(page, bbox)` via the document's
//! pre-computed `TextSpan` list.

use crate::models::source_document::{BBox, SourceDocument, TextSpan};

/// Returns the page and union-bbox covering the range [start, end). If the
/// range straddles a page boundary, takes the first page (§13).
#[must_use]
pub fn resolve_location(doc: &SourceDocument, start: usize, end: usize) -> (u32, BBox) {
    let containing: Vec<&TextSpan> = doc
        .parsed_spans
        .iter()
        .filter(|s| s.end_offset > start && s.start_offset < end)
        .collect();
    if containing.is_empty() {
        return (1, BBox::new(0.0, 0.0, 0.0, 0.0));
    }
    let first_page = containing[0].page;
    let mut union: Option<BBox> = None;
    for s in containing {
        if s.page != first_page {
            break;
        }
        union = Some(match union {
            None => s.bbox,
            Some(prev) => prev.union(s.bbox),
        });
    }
    (first_page, union.unwrap_or(BBox::new(0.0, 0.0, 0.0, 0.0)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ids::SourceDocId;

    fn doc(spans: Vec<TextSpan>) -> SourceDocument {
        SourceDocument {
            id: SourceDocId::new(),
            filename: String::new(),
            stored_path: String::new(),
            content_sha256: String::new(),
            mime_type: "application/pdf".into(),
            page_count: 1,
            parsed_text: String::new(),
            parsed_spans: spans,
            ocr_used: false,
            ingested_at: chrono::Utc::now(),
            ingested_by: None,
        }
    }

    #[test]
    fn returns_union_of_overlapping_spans_on_same_page() {
        let spans = vec![
            TextSpan {
                start_offset: 0,
                end_offset: 5,
                page: 1,
                bbox: BBox::new(0.0, 0.0, 50.0, 12.0),
            },
            TextSpan {
                start_offset: 5,
                end_offset: 10,
                page: 1,
                bbox: BBox::new(50.0, 0.0, 50.0, 12.0),
            },
        ];
        let (p, b) = resolve_location(&doc(spans), 0, 10);
        assert_eq!(p, 1);
        assert_eq!(b, BBox::new(0.0, 0.0, 100.0, 12.0));
    }

    #[test]
    fn takes_first_page_when_range_straddles_pages() {
        let spans = vec![
            TextSpan {
                start_offset: 0,
                end_offset: 5,
                page: 1,
                bbox: BBox::new(0.0, 0.0, 50.0, 12.0),
            },
            TextSpan {
                start_offset: 6,
                end_offset: 10,
                page: 2,
                bbox: BBox::new(0.0, 0.0, 50.0, 12.0),
            },
        ];
        let (p, _b) = resolve_location(&doc(spans), 0, 10);
        assert_eq!(p, 1);
    }

    #[test]
    fn returns_dummy_when_no_span_matches() {
        let (p, b) = resolve_location(&doc(vec![]), 0, 5);
        assert_eq!(p, 1);
        assert!(b.is_empty());
    }
}
