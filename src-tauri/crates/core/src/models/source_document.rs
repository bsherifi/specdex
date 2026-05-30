//! Source documents + their geometry primitives.
//!
//! Implements SPECDEX-V1.md §11.1 (`source_documents` table) and §12
//! (`BBox`, `TextSpan`).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::ids::SourceDocId;

/// Bounding box in PDF points (origin top-left, y grows downward).
/// All fields are f32 — sufficient precision for PDF coordinates and matches
/// pdfium's native float width.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, Type)]
pub struct BBox {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl BBox {
    #[must_use]
    pub fn new(x: f32, y: f32, w: f32, h: f32) -> Self {
        Self { x, y, w, h }
    }

    /// Returns the smallest bbox containing both `self` and `other`.
    #[must_use]
    pub fn union(self, other: Self) -> Self {
        let x = self.x.min(other.x);
        let y = self.y.min(other.y);
        let right = (self.x + self.w).max(other.x + other.w);
        let bottom = (self.y + self.h).max(other.y + other.h);
        Self {
            x,
            y,
            w: right - x,
            h: bottom - y,
        }
    }

    #[must_use]
    pub fn is_empty(self) -> bool {
        self.w <= 0.0 || self.h <= 0.0
    }
}

/// One contiguous span of layout-aware text on a page. Spans are
/// non-overlapping, in reading order, and contiguous within a page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct TextSpan {
    /// Byte offset of this span's first character in the parsed-document text.
    pub start_offset: usize,
    /// Byte offset of this span's last character + 1 in the parsed-document text.
    pub end_offset: usize,
    /// 1-indexed page number.
    pub page: u32,
    pub bbox: BBox,
}

impl TextSpan {
    #[must_use]
    pub fn len(&self) -> usize {
        self.end_offset.saturating_sub(self.start_offset)
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.start_offset >= self.end_offset
    }

    #[must_use]
    pub fn contains_offset(&self, offset: usize) -> bool {
        offset >= self.start_offset && offset < self.end_offset
    }
}

/// A source document row as stored. Mirrors §11.1 `source_documents`.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SourceDocument {
    pub id: SourceDocId,
    pub filename: String,
    /// Path under app-data-dir's `docs/` subdir.
    pub stored_path: String,
    pub content_sha256: String,
    pub mime_type: String,
    pub page_count: u32,
    pub parsed_text: String,
    pub parsed_spans: Vec<TextSpan>,
    pub ocr_used: bool,
    pub ingested_at: DateTime<Utc>,
    pub ingested_by: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bbox_union_covers_both_corners() {
        let a = BBox::new(10.0, 10.0, 20.0, 20.0);
        let b = BBox::new(50.0, 50.0, 5.0, 5.0);
        let u = a.union(b);
        assert_eq!(u, BBox::new(10.0, 10.0, 45.0, 45.0));
    }

    #[test]
    fn textspan_offsets_and_length() {
        let s = TextSpan {
            start_offset: 100,
            end_offset: 107,
            page: 1,
            bbox: BBox::new(0.0, 0.0, 1.0, 1.0),
        };
        assert_eq!(s.len(), 7);
        assert!(s.contains_offset(100));
        assert!(s.contains_offset(106));
        assert!(!s.contains_offset(107));
        assert!(!s.contains_offset(99));
    }

    #[test]
    fn source_document_round_trip_json() {
        let doc = SourceDocument {
            id: SourceDocId::new(),
            filename: "spec.pdf".into(),
            stored_path: "docs/abc.pdf".into(),
            content_sha256: "0".repeat(64),
            mime_type: "application/pdf".into(),
            page_count: 5,
            parsed_text: "hello".into(),
            parsed_spans: vec![],
            ocr_used: false,
            ingested_at: Utc::now(),
            ingested_by: Some("Sara".into()),
        };
        let json = serde_json::to_string(&doc).unwrap();
        let back: SourceDocument = serde_json::from_str(&json).unwrap();
        assert_eq!(back.filename, doc.filename);
        assert_eq!(back.page_count, 5);
    }
}
