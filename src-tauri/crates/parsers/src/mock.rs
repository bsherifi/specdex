//! `MockParser` — produces deterministic `ParsedDocument`s from a recipe.
//!
//! Used in ingest tests + scanner tests + frontend Tauri-driver flows where
//! we don't want to ship a real PDF.
//!
//! Synthetic bbox/page math casts integer lengths to `f32`; the precision loss
//! is irrelevant for fixture geometry.
#![allow(clippy::cast_precision_loss)]

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use specdex_core::models::source_document::{BBox, TextSpan};

use crate::error::{ParseError, Result};
use crate::parsed_document::{ParseOptions, ParsedDocument};
use crate::parser_trait::DocumentParser;

#[derive(Default)]
pub struct MockParser {
    recipes: Mutex<HashMap<PathBuf, ParsedDocument>>,
}

impl MockParser {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a synthetic `ParsedDocument` for a given path. Subsequent
    /// `parse(path, ...)` calls return clones of this document.
    pub fn register(&self, path: impl Into<PathBuf>, doc: ParsedDocument) {
        self.recipes.lock().unwrap().insert(path.into(), doc);
    }

    /// Convenience: builds a `ParsedDocument` where `text` is the input, pages
    /// separated by `\u{000C}`. Each whitespace-delimited token gets a
    /// synthetic single-line bbox on its page, and a `TextSpan` whose byte
    /// offsets index back into `text`.
    #[must_use]
    pub fn doc_from_text(text: &str) -> ParsedDocument {
        let pages: Vec<&str> = text.split('\u{000C}').collect();
        let page_count = pages.len() as u32;
        let mut spans = Vec::new();
        // Byte offset where the current page begins in the full `text`. The
        // form-feed separator is one byte (U+000C), so each page starts one
        // byte past the end of the previous page's text.
        let mut page_start = 0usize;
        for (idx, page_text) in pages.iter().enumerate() {
            let page_no = (idx + 1) as u32;
            let mut col = 0.0_f32;
            // Search position within `page_text`; advances past each matched
            // token so repeated tokens resolve to distinct, in-order offsets.
            let mut cursor = 0usize;
            for token in page_text.split_whitespace() {
                let rel = cursor + page_text[cursor..].find(token).unwrap();
                let start_offset = page_start + rel;
                let end_offset = start_offset + token.len();
                spans.push(TextSpan {
                    start_offset,
                    end_offset,
                    page: page_no,
                    bbox: BBox::new(col, 50.0, token.len() as f32 * 6.0, 12.0),
                });
                col += token.len() as f32 * 6.0 + 6.0;
                cursor = rel + token.len();
            }
            page_start += page_text.len() + 1;
        }
        ParsedDocument {
            page_count,
            text: text.to_string(),
            spans,
            ocr_used: false,
        }
    }
}

impl DocumentParser for MockParser {
    fn parse(&self, path: &Path, _opts: ParseOptions) -> Result<ParsedDocument> {
        self.recipes
            .lock()
            .unwrap()
            .get(path)
            .cloned()
            .ok_or_else(|| ParseError::NotFound(path.display().to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_then_parse_returns_clone() {
        let mp = MockParser::new();
        let p = std::path::PathBuf::from("/fake/spec.pdf");
        let d = MockParser::doc_from_text("BAC3082 is a finish code\u{000C}page 2 text");
        mp.register(&p, d.clone());
        let got = mp.parse(&p, ParseOptions::default()).unwrap();
        assert_eq!(got.page_count, 2);
        assert!(got.text.contains("BAC3082"));
    }

    #[test]
    fn parse_returns_not_found_for_unregistered_path() {
        let mp = MockParser::new();
        let err = mp
            .parse(std::path::Path::new("/nope.pdf"), ParseOptions::default())
            .unwrap_err();
        assert!(matches!(err, ParseError::NotFound(_)));
    }

    #[test]
    fn doc_from_text_offsets_resolve_to_correct_substring() {
        let text = "alpha beta gamma";
        let d = MockParser::doc_from_text(text);
        // Each span's [start..end] must match its rendered token.
        for span in &d.spans {
            assert_eq!(
                text[span.start_offset..span.end_offset].chars().count(),
                span.end_offset - span.start_offset
            );
        }
        assert!(d
            .spans
            .iter()
            .any(|s| text[s.start_offset..s.end_offset] == *"beta"));
    }
}
