//! `MockParser` — produces deterministic `ParsedDocument`s from a recipe.
//!
//! Used in ingest tests + scanner tests + frontend Tauri-driver flows where
//! we don't want to ship a real PDF.
//!
//! Synthetic bbox/page math casts integer lengths to `f32` and small `usize`
//! page counts to `u32`; the precision loss / truncation is irrelevant for
//! fixture geometry.
#![allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)]

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
    fallback_to_file: bool,
}

impl MockParser {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns a mock parser that accepts arbitrary files. This is used only as
    /// a desktop fallback when `PDFium` is unavailable, so the app can still
    /// exercise ingest/storage flows without native parser assets installed.
    #[must_use]
    pub fn permissive() -> Self {
        Self {
            recipes: Mutex::new(HashMap::new()),
            fallback_to_file: true,
        }
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
    fn parse(&self, path: &Path, opts: ParseOptions) -> Result<ParsedDocument> {
        if let Some(doc) = self.recipes.lock().unwrap().get(path).cloned() {
            return Ok(doc);
        }
        if self.fallback_to_file {
            return fallback_doc(path, &opts);
        }
        Err(ParseError::NotFound(path.display().to_string()))
    }
}

fn fallback_doc(path: &Path, opts: &ParseOptions) -> Result<ParsedDocument> {
    let bytes = std::fs::read(path)?;
    let text = extract_printable_text(&bytes);
    let filename = path
        .file_name()
        .map_or_else(|| path.display().to_string(), |s| s.to_string_lossy().to_string());
    let text = if text.trim().is_empty() {
        filename
    } else {
        text
    };
    let mut doc = MockParser::doc_from_text(&text);
    doc.page_count = count_pdf_pages(&bytes);
    doc.ocr_used = opts.ocr;
    Ok(doc)
}

fn count_pdf_pages(bytes: &[u8]) -> u32 {
    const NEEDLE: &[u8] = b"/Type /Page";
    let count = bytes.windows(NEEDLE.len()).filter(|w| *w == NEEDLE).count();
    u32::try_from(count.max(1)).unwrap_or(u32::MAX)
}

fn extract_printable_text(bytes: &[u8]) -> String {
    const MAX_CHARS: usize = 200_000;
    let mut out = String::new();
    let mut last_was_space = false;
    for &byte in bytes {
        if out.len() >= MAX_CHARS {
            break;
        }
        let next = match byte {
            b'\n' | b'\r' | b'\t' | b' ' => Some(' '),
            0x20..=0x7e => Some(char::from(byte)),
            _ => None,
        };
        if let Some(ch) = next {
            if ch == ' ' {
                if !last_was_space {
                    out.push(ch);
                    last_was_space = true;
                }
            } else {
                out.push(ch);
                last_was_space = false;
            }
        }
    }
    out.trim().to_string()
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
    fn permissive_parser_accepts_unregistered_files() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("sample.pdf");
        std::fs::write(&path, b"%PDF-1.4\n1 0 obj\n/Type /Page\nBT (BAC3082) ET\n").unwrap();
        let mp = MockParser::permissive();

        let doc = mp.parse(&path, ParseOptions::default()).unwrap();

        assert_eq!(doc.page_count, 1);
        assert!(doc.text.contains("BAC3082"));
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
