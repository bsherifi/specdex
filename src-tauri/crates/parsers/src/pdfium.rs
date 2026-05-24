//! Real PDF parser via `pdfium-render`.
//!
//! pdfium-render dynamically loads `PDFium`'s shared library. The library
//! search order:
//!   1. Path passed explicitly to `PdfiumParser::new(library_path)`.
//!   2. `$SPECDEX_PDFIUM_PATH` env var.
//!   3. System search paths (e.g. `LD_LIBRARY_PATH`).
//!
//! Plan 41 bundles the library under `src-tauri/binaries/pdfium/`; the Tauri
//! adapter passes the absolute path on startup.
//!
//! Page/word counts are bounded by `PdfPageIndex` (`u16`), so the `usize ->
//! u32` casts for page numbers can never truncate.
#![allow(clippy::cast_possible_truncation)]

use std::path::Path;

use pdfium_render::prelude::*;

use specdex_core::models::source_document::{BBox, TextSpan};

use crate::error::{ParseError, Result};
use crate::parsed_document::{ParseOptions, ParsedDocument};
use crate::parser_trait::DocumentParser;

pub struct PdfiumParser {
    pdfium: Pdfium,
}

impl PdfiumParser {
    pub fn new(library_path: Option<&Path>) -> Result<Self> {
        let bindings = match library_path {
            Some(p) => Pdfium::bind_to_library(p),
            None => match std::env::var("SPECDEX_PDFIUM_PATH") {
                Ok(p) => Pdfium::bind_to_library(p),
                Err(_) => Pdfium::bind_to_system_library(),
            },
        }
        .or_else(|_| Pdfium::bind_to_system_library())
        .map_err(|e| ParseError::PdfiumNotAvailable(e.to_string()))?;
        Ok(Self {
            pdfium: Pdfium::new(bindings),
        })
    }
}

impl DocumentParser for PdfiumParser {
    fn parse(&self, path: &Path, _opts: ParseOptions) -> Result<ParsedDocument> {
        // We never supply a password, so an encrypted PDF surfaces as
        // `PasswordError`; v1 refuses encrypted documents entirely (§12).
        let doc = self
            .pdfium
            .load_pdf_from_file(path, None)
            .map_err(|e| match e {
                PdfiumError::PdfiumLibraryInternalError(PdfiumInternalError::PasswordError) => {
                    ParseError::Encrypted
                }
                other => ParseError::InvalidFormat(other.to_string()),
            })?;

        let mut full_text = String::new();
        let mut spans = Vec::new();
        let pages = doc.pages();
        let page_count = u32::from(pages.len());

        for (idx, page) in pages.iter().enumerate() {
            if idx > 0 {
                full_text.push('\u{000C}'); // form feed page separator
            }
            let page_no = (idx + 1) as u32;
            let text = page
                .text()
                .map_err(|e| ParseError::Internal(e.to_string()))?;

            // Accumulate runs of non-whitespace chars into word-level spans,
            // flushing on each whitespace char.
            let mut word_start: Option<usize> = None;
            let mut word_bbox: Option<BBox> = None;
            for ch in text.chars().iter() {
                let Some(c) = ch.unicode_char() else { continue };
                let char_bbox = ch.loose_bounds().ok().map(|r| {
                    BBox::new(
                        r.left().value,
                        r.top().value,
                        r.width().value,
                        r.height().value,
                    )
                });

                if c.is_whitespace() {
                    if let Some(start) = word_start.take() {
                        spans.push(TextSpan {
                            start_offset: start,
                            end_offset: full_text.len(),
                            page: page_no,
                            bbox: word_bbox.take().unwrap_or(BBox::new(0.0, 0.0, 0.0, 0.0)),
                        });
                    }
                } else {
                    if word_start.is_none() {
                        word_start = Some(full_text.len());
                    }
                    if let Some(b) = char_bbox {
                        word_bbox = Some(word_bbox.map_or(b, |cur| cur.union(b)));
                    }
                }
                full_text.push(c);
            }

            if let Some(start) = word_start.take() {
                spans.push(TextSpan {
                    start_offset: start,
                    end_offset: full_text.len(),
                    page: page_no,
                    bbox: word_bbox.take().unwrap_or(BBox::new(0.0, 0.0, 0.0, 0.0)),
                });
            }
        }

        Ok(ParsedDocument {
            page_count,
            text: full_text,
            spans,
            ocr_used: false,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Run only when `SPECDEX_PDFIUM_PATH` is set or system pdfium is present.
    #[test]
    fn parser_constructs_when_library_path_provided_via_env() {
        if std::env::var("SPECDEX_PDFIUM_PATH").is_err() {
            eprintln!("skipping: SPECDEX_PDFIUM_PATH unset");
            return;
        }
        let parser = PdfiumParser::new(None).expect("pdfium should bind");
        let _ = parser;
    }
}
