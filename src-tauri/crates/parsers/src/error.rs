//! `ParseError` — translated by ingest layer into `CoreError::Parse`.

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, thiserror::Error, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum ParseError {
    #[error("file not found: {0}")]
    NotFound(String),
    #[error("not a PDF or unreadable: {0}")]
    InvalidFormat(String),
    #[error("PDF is encrypted")]
    Encrypted,
    #[error("OCR failed: {0}")]
    OcrFailed(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("pdfium library not found: {0}")]
    PdfiumNotAvailable(String),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<std::io::Error> for ParseError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, ParseError>;
