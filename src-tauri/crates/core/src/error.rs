//! `CoreError` — the one error every core function returns (§10 rule 9).
//! Adapters map it onto their transport's native error shape.

use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, thiserror::Error, Serialize, Deserialize, Type)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum CoreError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("validation: {0}")]
    Validation(String),

    #[error("schema validation: {0}")]
    SchemaValidation(crate::models::schema::SchemaValidationError),

    #[error("identity validation: {0}")]
    IdentityValidation(crate::models::identity::IdentityValidationError),

    #[error("parse: {0}")]
    Parse(String),

    #[error("io: {0}")]
    Io(String),

    #[error("db: {0}")]
    Db(String),

    #[error("search index: {0}")]
    Search(String),

    #[error("internal: {0}")]
    Internal(String),
}

impl From<std::io::Error> for CoreError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

impl From<serde_json::Error> for CoreError {
    fn from(e: serde_json::Error) -> Self {
        Self::Parse(e.to_string())
    }
}

impl From<zip::result::ZipError> for CoreError {
    fn from(e: zip::result::ZipError) -> Self {
        Self::Internal(e.to_string())
    }
}

impl From<rusqlite::Error> for CoreError {
    fn from(e: rusqlite::Error) -> Self {
        match &e {
            rusqlite::Error::QueryReturnedNoRows => Self::NotFound("row".into()),
            _ => Self::Db(e.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_round_trips_through_json() {
        let e = CoreError::NotFound("kb=abc".into());
        let s = serde_json::to_string(&e).unwrap();
        let back: CoreError = serde_json::from_str(&s).unwrap();
        assert_eq!(back.to_string(), e.to_string());
    }
}
