//! Knowledge base type (§11.1 `knowledge_bases`).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::ids::KbId;
use super::schema::Schema;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Kb {
    pub id: KbId,
    pub name: String,
    pub description: Option<String>,
    pub schema: Schema,
    pub primary_field: String,
    pub searchable_fields: Vec<String>,
    /// Hex like `#FFD54F`. KB color picker (plan 25) validates this against
    /// the 8-color palette declared in `tailwind.config.ts`.
    pub highlight_color: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub edited_by: Option<String>,
}

/// Lightweight version for list views — avoids shipping the full schema JSON
/// in `GET /kbs` responses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct KbSummary {
    pub id: KbId,
    pub name: String,
    pub description: Option<String>,
    pub highlight_color: String,
    pub entry_count: u64,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::schema::{FieldDef, FieldType};

    #[test]
    fn kb_round_trips_through_json() {
        let primary = FieldDef {
            name: "code".into(),
            label: "Code".into(),
            field_type: FieldType::Text,
            required: true,
            searchable: Some(true),
            primary: true,
            renamed_from: None,
        };
        let kb = Kb {
            id: KbId::new(),
            name: "Boeing Specs".into(),
            description: Some("Boeing standards".into()),
            schema: Schema::new(vec![primary]),
            primary_field: "code".into(),
            searchable_fields: vec!["code".into()],
            highlight_color: "#f59e0b".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            edited_by: Some("Sara".into()),
        };
        let s = serde_json::to_string(&kb).unwrap();
        let back: Kb = serde_json::from_str(&s).unwrap();
        assert_eq!(back.name, "Boeing Specs");
        assert_eq!(back.schema.fields.len(), 1);
    }
}
