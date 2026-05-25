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
            // pdfium-render exposes PDF user space: origin at the page's
            // bottom-left, y increasing upward. Specdex's `BBox` contract (and
            // the OCR parser, and the frontend highlight layer) are top-left
            // origin, y down. Flip y against the page height so every
            // coordinate source agrees — otherwise highlights render mirrored.
            let page_height = page.page_size().height().value;
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
                    // `r.top()` is the box's upper edge in bottom-left space;
                    // its top-left-origin y is `page_height - top`.
                    BBox::new(
                        r.left().value,
                        page_height - r.top().value,
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

    /// Binds pdfium from the env var or the in-repo binary, or returns `None`
    /// so coordinate tests skip cleanly where no library is reachable.
    fn try_pdfium() -> Option<PdfiumParser> {
        if std::env::var("SPECDEX_PDFIUM_PATH").is_ok() {
            return PdfiumParser::new(None).ok();
        }
        let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("binaries/pdfium/macos-arm/lib/libpdfium.dylib");
        if repo.exists() {
            PdfiumParser::new(Some(&repo)).ok()
        } else {
            PdfiumParser::new(None).ok()
        }
    }

    /// A valid single-page Letter (612×792 pt) PDF with one label drawn near the
    /// top (PDF y=750) and one near the bottom (PDF y=40), in bottom-left space.
    fn two_label_pdf() -> Vec<u8> {
        let stream = "BT /F1 12 Tf 72 750 Td (TOPLABEL) Tj ET\n\
                      BT /F1 12 Tf 72 40 Td (BOTLABEL) Tj ET";
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] \
              /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
                .to_string(),
            format!("<< /Length {} >>\nstream\n{stream}\nendstream", stream.len()),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
        ];
        let mut pdf = Vec::new();
        pdf.extend_from_slice(b"%PDF-1.4\n");
        let mut offsets = Vec::with_capacity(objects.len());
        for (i, body) in objects.iter().enumerate() {
            offsets.push(pdf.len());
            pdf.extend_from_slice(format!("{} 0 obj\n{body}\nendobj\n", i + 1).as_bytes());
        }
        let xref_pos = pdf.len();
        let size = objects.len() + 1;
        pdf.extend_from_slice(format!("xref\n0 {size}\n").as_bytes());
        pdf.extend_from_slice(b"0000000000 65535 f \n");
        for off in &offsets {
            pdf.extend_from_slice(format!("{off:010} 00000 n \n").as_bytes());
        }
        pdf.extend_from_slice(
            format!("trailer\n<< /Size {size} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF")
                .as_bytes(),
        );
        pdf
    }

    /// Regression guard for the Y-axis flip: pdfium is bottom-left origin, but
    /// `BBox` is top-left. A label drawn near the top of the page must come back
    /// with a *smaller* y than one near the bottom. Pre-fix this was reversed.
    #[test]
    fn pdfium_emits_top_left_origin_bboxes() {
        let Some(parser) = try_pdfium() else {
            eprintln!("skipping: pdfium library unavailable");
            return;
        };
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("labels.pdf");
        std::fs::write(&path, two_label_pdf()).unwrap();

        let doc = parser.parse(&path, ParseOptions::default()).unwrap();
        let span_y = |needle: &str| {
            doc.spans
                .iter()
                .find(|s| &doc.text[s.start_offset..s.end_offset] == needle)
                .unwrap_or_else(|| panic!("missing span {needle} in {:?}", doc.text))
                .bbox
                .y
        };
        let (top_y, bot_y) = (span_y("TOPLABEL"), span_y("BOTLABEL"));
        assert!(top_y < bot_y, "top label y={top_y} should be < bottom label y={bot_y}");
        assert!(top_y < 396.0, "top label should sit in the page's top half: y={top_y}");
    }
}
