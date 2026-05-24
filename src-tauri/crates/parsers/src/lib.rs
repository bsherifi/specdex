//! Specdex parsers — `DocumentParser` trait + impls.
//!
//! Implements SPECDEX-V1.md §12. The trait, types, and `MockParser` are
//! always built. `PdfiumParser` and `OcrParser` are behind the `pdfium`
//! and `ocr` features (default off for `cargo check` on machines without
//! pdfium; the Tauri binary opts into `real-parsers`). `OcrParser` is
//! backed by ocrs (pure Rust, no native deps beyond the pdfium used to
//! rasterize pages).

pub mod error;
pub mod mock;
pub mod parsed_document;
pub mod parser_trait;

#[cfg(feature = "pdfium")]
pub mod pdfium;

#[cfg(feature = "ocr")]
pub mod ocr;

pub use error::{ParseError, Result};
pub use mock::MockParser;
pub use parsed_document::{ParseOptions, ParsedDocument};
pub use parser_trait::DocumentParser;

#[cfg(feature = "pdfium")]
pub use pdfium::PdfiumParser;

#[cfg(feature = "ocr")]
pub use ocr::OcrParser;
