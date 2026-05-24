//! `ParsedDocument` + `ParseOptions`. Per §12.

use serde::{Deserialize, Serialize};
use specdex_core::models::source_document::TextSpan;
use specta::Type;

#[derive(Debug, Clone, Default, Serialize, Deserialize, Type)]
pub struct ParseOptions {
    /// User explicitly opted into OCR for this document.
    pub ocr: bool,
}

// v1 ships English-only via ocrs's default model. v1.1 may add language
// selection if ocrs publishes multilingual models, or via the PP-OCRv5
// swap path described in the header.

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ParsedDocument {
    pub page_count: u32,
    /// Full document text with pages separated by `\u{000C}` (form feed).
    pub text: String,
    /// Layout-aware spans. Non-overlapping, reading-order, contiguous within
    /// a page; gaps permitted at page boundaries / whitespace.
    pub spans: Vec<TextSpan>,
    pub ocr_used: bool,
}

impl ParsedDocument {
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.text.is_empty() && self.page_count == 0
    }

    /// Average characters per page. Used by ingest to decide whether to
    /// surface the "needs OCR?" banner (§12: threshold 50 chars/page).
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn avg_chars_per_page(&self) -> f32 {
        if self.page_count == 0 {
            return 0.0;
        }
        let total = self.text.chars().filter(|c| *c != '\u{000C}').count();
        total as f32 / self.page_count as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn avg_chars_per_page_excludes_form_feed() {
        let d = ParsedDocument {
            page_count: 2,
            text: "abc\u{000C}defgh".into(),
            spans: vec![],
            ocr_used: false,
        };
        // 3 + 5 = 8 chars across 2 pages.
        assert!((d.avg_chars_per_page() - 4.0).abs() < f32::EPSILON);
    }
}
