//! Identity stub (§17 v1). Single-row table; just the display name.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Identity {
    pub display_name: String,
    pub created_at: DateTime<Utc>,
}

impl Identity {
    pub fn new(display_name: &str) -> Result<Self, IdentityValidationError> {
        let trimmed = display_name.trim();
        if trimmed.is_empty() {
            return Err(IdentityValidationError::Empty);
        }
        if trimmed.chars().count() > 64 {
            return Err(IdentityValidationError::TooLong);
        }
        Ok(Self {
            display_name: trimmed.to_owned(),
            created_at: Utc::now(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type, thiserror::Error)]
#[serde(tag = "code")]
pub enum IdentityValidationError {
    #[error("display name cannot be empty")]
    Empty,
    #[error("display name cannot exceed 64 characters")]
    TooLong,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_or_whitespace() {
        assert_eq!(Identity::new(""), Err(IdentityValidationError::Empty));
        assert_eq!(Identity::new("   "), Err(IdentityValidationError::Empty));
    }

    #[test]
    fn trims_and_keeps_inner_whitespace() {
        let id = Identity::new("  Sara Chen  ").unwrap();
        assert_eq!(id.display_name, "Sara Chen");
    }

    #[test]
    fn rejects_over_64_chars() {
        let long = "x".repeat(65);
        assert_eq!(Identity::new(&long), Err(IdentityValidationError::TooLong));
    }
}
