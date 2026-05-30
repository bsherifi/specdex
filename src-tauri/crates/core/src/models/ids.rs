//! Newtype UUIDs (UUID v7 — time-sortable). Each ID is a transparent string
//! at the TS boundary (specta maps Uuid to `string`).
//!
//! Implements SPECDEX-V1.md §11 ("All IDs are UUIDs v7 (time-sortable)").

use serde::{Deserialize, Serialize};
use specta::Type;
use uuid::Uuid;

macro_rules! id_newtype {
    ($name:ident) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Type)]
        #[serde(transparent)]
        #[repr(transparent)]
        pub struct $name(pub Uuid);

        impl $name {
            #[must_use]
            pub fn new() -> Self {
                Self(Uuid::now_v7())
            }

            #[must_use]
            pub fn from_uuid(u: Uuid) -> Self {
                Self(u)
            }

            #[must_use]
            pub fn as_uuid(&self) -> Uuid {
                self.0
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                self.0.fmt(f)
            }
        }

        impl std::str::FromStr for $name {
            type Err = uuid::Error;
            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Uuid::parse_str(s).map(Self)
            }
        }
    };
}

id_newtype!(KbId);
id_newtype!(EntryId);
id_newtype!(SourceDocId);
id_newtype!(AttachmentId);
id_newtype!(JobId);
id_newtype!(SchemaHistoryId);

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn new_ids_are_unique_and_v7() {
        let a = KbId::new();
        let b = KbId::new();
        assert_ne!(a, b);
        // v7 stores version 7 in the high nibble of the 7th byte (index 6).
        assert_eq!(a.as_uuid().get_version_num(), 7);
    }

    #[test]
    fn ids_round_trip_through_json_as_string() {
        let id = EntryId::new();
        let json = serde_json::to_string(&id).unwrap();
        let recovered: EntryId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, recovered);
        // transparent => no curly braces, just the quoted UUID string.
        assert!(json.starts_with('"'));
    }

    #[test]
    fn from_str_parses_canonical_form() {
        let original = SourceDocId::new();
        let s = original.to_string();
        let parsed = SourceDocId::from_str(&s).unwrap();
        assert_eq!(original, parsed);
    }
}
