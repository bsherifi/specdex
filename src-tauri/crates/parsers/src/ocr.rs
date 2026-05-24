//! ocrs-backed OCR. Renders each page via pdfium to an image buffer, runs
//! ocrs (pure Rust, MIT/Apache-2.0). No native C++ libs; the only native
//! dep transitively pulled in is pdfium itself (used for page rasterization).
//!
//! Trade-off accepted (§12): OCR'd PDFs have no native pdf.js text layer in
//! v1, so users can't text-select on them. Auto-highlighting still works.
//!
//! ocrs reports word boxes in image-pixel coords; we scale them to PDF points.
//! Page numbers and pixel/point coordinates need lossy int<->float casts that
//! are inherent to coordinate math.
#![allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)]

use std::path::Path;

use image::DynamicImage;
use ocrs::{ImageSource, OcrEngine, OcrEngineParams, TextItem};
use pdfium_render::prelude::*;
use rten::Model;

use specdex_core::models::source_document::{BBox, TextSpan};

use crate::error::{ParseError, Result};
use crate::parsed_document::{ParseOptions, ParsedDocument};
use crate::parser_trait::DocumentParser;

pub struct OcrParser {
    pdfium: Pdfium,
    engine: OcrEngine,
}

impl OcrParser {
    /// Load both .rten model files (text-detection + text-recognition) and
    /// construct an `OcrEngine`. Models ship in `src-tauri/binaries/ocrs/`
    /// per plan 41; paths are resolved by the Tauri adapter at startup.
    pub fn new(
        pdfium_library_path: Option<&Path>,
        detection_model_path: &Path,
        recognition_model_path: &Path,
    ) -> Result<Self> {
        let bindings = match pdfium_library_path {
            Some(p) => Pdfium::bind_to_library(p),
            None => Pdfium::bind_to_system_library(),
        }
        .or_else(|_| Pdfium::bind_to_system_library())
        .map_err(|e| ParseError::PdfiumNotAvailable(e.to_string()))?;
        let detection = Model::load_file(detection_model_path)
            .map_err(|e| ParseError::OcrFailed(format!("detection model: {e}")))?;
        let recognition = Model::load_file(recognition_model_path)
            .map_err(|e| ParseError::OcrFailed(format!("recognition model: {e}")))?;
        let engine = OcrEngine::new(OcrEngineParams {
            detection_model: Some(detection),
            recognition_model: Some(recognition),
            ..Default::default()
        })
        .map_err(|e| ParseError::OcrFailed(e.to_string()))?;
        Ok(Self {
            pdfium: Pdfium::new(bindings),
            engine,
        })
    }
}

impl DocumentParser for OcrParser {
    fn parse(&self, path: &Path, _opts: ParseOptions) -> Result<ParsedDocument> {
        let doc = self
            .pdfium
            .load_pdf_from_file(path, None)
            .map_err(|e| ParseError::InvalidFormat(e.to_string()))?;

        let mut full_text = String::new();
        let mut spans = Vec::new();
        let pages = doc.pages();
        let page_count = u32::from(pages.len());

        for (idx, page) in pages.iter().enumerate() {
            if idx > 0 {
                full_text.push('\u{000C}');
            }
            let page_no = (idx + 1) as u32;

            let render_cfg = PdfRenderConfig::new()
                .set_target_width(2000) // ~250 DPI on letter; good OCR/perf trade
                .render_form_data(false)
                .render_annotations(false);
            let bitmap = page
                .render_with_config(&render_cfg)
                .map_err(|e| ParseError::Internal(e.to_string()))?;
            let img: DynamicImage = bitmap.as_image();
            let rgb = img.to_rgb8();
            let (img_w, img_h) = (rgb.width() as f32, rgb.height() as f32);

            // ocrs bbox is in image-pixel coords; convert to PDF points using
            // the page size.
            let page_size = page.page_size();
            let scale_x = page_size.width().value / img_w;
            let scale_y = page_size.height().value / img_h;

            let source = ImageSource::from_bytes(rgb.as_raw(), rgb.dimensions())
                .map_err(|e| ParseError::OcrFailed(e.to_string()))?;
            let ocr_input = self
                .engine
                .prepare_input(source)
                .map_err(|e| ParseError::OcrFailed(e.to_string()))?;
            let word_rects = self
                .engine
                .detect_words(&ocr_input)
                .map_err(|e| ParseError::OcrFailed(e.to_string()))?;
            let line_rects = self.engine.find_text_lines(&ocr_input, &word_rects);
            let lines = self
                .engine
                .recognize_text(&ocr_input, &line_rects)
                .map_err(|e| ParseError::OcrFailed(e.to_string()))?;

            // `recognize_text` returns one `Option<TextLine>` per input line;
            // `None` means the model couldn't recognize anything. `words()` is
            // a `TextLine` method; `bounding_rect()` comes from `TextItem`.
            for line in lines.into_iter().flatten() {
                for word in line.words() {
                    let text = word.to_string();
                    let trimmed = text.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let rect = word.bounding_rect(); // axis-aligned ocrs::Rect (i32)
                    let start_offset = full_text.len();
                    full_text.push_str(trimmed);
                    let end_offset = full_text.len();
                    full_text.push(' ');
                    spans.push(TextSpan {
                        start_offset,
                        end_offset,
                        page: page_no,
                        bbox: BBox::new(
                            rect.left() as f32 * scale_x,
                            rect.top() as f32 * scale_y,
                            rect.width() as f32 * scale_x,
                            rect.height() as f32 * scale_y,
                        ),
                    });
                }
            }
        }

        Ok(ParsedDocument {
            page_count,
            text: full_text,
            spans,
            ocr_used: true,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Run only when ocrs models are available locally (CI / dev set these
    /// after running `installers/download-ocrs-models.sh`).
    #[test]
    fn parser_constructs_when_models_available() {
        let det = std::env::var("SPECDEX_OCRS_DETECTION_MODEL").ok();
        let rec = std::env::var("SPECDEX_OCRS_RECOGNITION_MODEL").ok();
        let (Some(det), Some(rec)) = (det, rec) else {
            eprintln!("skipping: SPECDEX_OCRS_*_MODEL unset");
            return;
        };
        let _p = OcrParser::new(None, std::path::Path::new(&det), std::path::Path::new(&rec));
    }
}
