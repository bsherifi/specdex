//! Validates an entry's `data` against its KB's schema.
//!
//! Returns the **`primary_value`** on success (extracted from the primary
//! field) so callers can persist it to the denormalized column.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use specta::Type;

use crate::models::entry::EntryData;
use crate::models::schema::{FieldType, Schema};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type, thiserror::Error)]
#[serde(tag = "code", content = "data")]
pub enum EntryValidationError {
    #[error("required field `{0}` missing or empty")]
    RequiredMissing(String),
    #[error("field `{0}` has wrong type: expected {expected}, got {got}", expected = .1, got = .2)]
    WrongType(String, String, String),
    #[error("field `{0}` value `{1}` is not one of the allowed select options")]
    InvalidSelectOption(String, String),
    #[error("unknown field `{0}` in entry data")]
    UnknownField(String),
    #[error("primary field `{0}` must be a non-empty string")]
    InvalidPrimary(String),
}

/// Returns the `primary_value` string on success. Validates every field
/// declared in `schema`; reports every error rather than short-circuiting
/// so the UI can highlight all bad fields at once.
pub fn validate(data: &EntryData, schema: &Schema) -> Result<String, Vec<EntryValidationError>> {
    let mut errs = Vec::new();

    // Unknown field check
    let known: std::collections::HashSet<&str> =
        schema.fields.iter().map(|f| f.name.as_str()).collect();
    for k in data.keys() {
        if k.starts_with('_') {
            // `_archived` and other underscore-prefixed keys are reserved.
            continue;
        }
        if !known.contains(k.as_str()) {
            errs.push(EntryValidationError::UnknownField(k.clone()));
        }
    }

    let mut primary: Option<String> = None;
    for f in &schema.fields {
        let val = data.get(&f.name);
        if f.required {
            match val {
                None | Some(Value::Null) => {
                    errs.push(EntryValidationError::RequiredMissing(f.name.clone()));
                    continue;
                }
                Some(Value::String(s)) if s.trim().is_empty() => {
                    errs.push(EntryValidationError::RequiredMissing(f.name.clone()));
                    continue;
                }
                _ => {}
            }
        }
        if let Some(v) = val {
            if !value_matches_type(v, &f.field_type) {
                errs.push(EntryValidationError::WrongType(
                    f.name.clone(),
                    type_name(&f.field_type),
                    json_kind(v),
                ));
                continue;
            }
            if let FieldType::Select { options } = &f.field_type {
                if let Value::String(s) = v {
                    if !options.iter().any(|o| o == s) {
                        errs.push(EntryValidationError::InvalidSelectOption(
                            f.name.clone(),
                            s.clone(),
                        ));
                    }
                }
            }
            if f.primary {
                match v {
                    Value::String(s) if !s.trim().is_empty() => {
                        primary = Some(s.trim().to_owned());
                    }
                    _ => {
                        errs.push(EntryValidationError::InvalidPrimary(f.name.clone()));
                    }
                }
            }
        }
    }

    if errs.is_empty() {
        primary.ok_or_else(|| {
            vec![EntryValidationError::InvalidPrimary(
                schema.primary().map(|f| f.name.clone()).unwrap_or_default(),
            )]
        })
    } else {
        Err(errs)
    }
}

fn value_matches_type(v: &Value, t: &FieldType) -> bool {
    // Null is accepted for every field type (an empty/cleared field).
    if v.is_null() {
        return true;
    }
    match t {
        FieldType::Text
        | FieldType::TextMultiline
        | FieldType::Url
        | FieldType::Select { .. }
        | FieldType::ImageAttachment => v.is_string(),
        FieldType::Number => v.is_number(),
        FieldType::Date => v
            .as_str()
            .is_some_and(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()),
    }
}

fn type_name(t: &FieldType) -> String {
    match t {
        FieldType::Text => "text".into(),
        FieldType::TextMultiline => "text_multiline".into(),
        FieldType::Number => "number".into(),
        FieldType::Date => "date (YYYY-MM-DD)".into(),
        FieldType::Select { .. } => "select".into(),
        FieldType::Url => "url".into(),
        FieldType::ImageAttachment => "image_attachment".into(),
    }
}

fn json_kind(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(_) => "bool".into(),
        Value::Number(_) => "number".into(),
        Value::String(_) => "string".into(),
        Value::Array(_) => "array".into(),
        Value::Object(_) => "object".into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::schema::FieldDef;
    use serde_json::json;

    fn primary_text(name: &str) -> FieldDef {
        FieldDef {
            name: name.into(),
            label: name.into(),
            field_type: FieldType::Text,
            required: true,
            searchable: Some(true),
            primary: true,
            renamed_from: None,
        }
    }

    #[test]
    fn validates_simple_required_text() {
        let schema = Schema::new(vec![primary_text("code")]);
        let mut data = EntryData::new();
        data.insert("code".into(), json!("BAC3082"));
        assert_eq!(validate(&data, &schema).unwrap(), "BAC3082");
    }

    #[test]
    fn rejects_missing_required() {
        let schema = Schema::new(vec![primary_text("code")]);
        let data = EntryData::new();
        let errs = validate(&data, &schema).unwrap_err();
        assert!(matches!(errs[0], EntryValidationError::RequiredMissing(_)));
    }

    #[test]
    fn rejects_select_with_non_option_value() {
        let mut schema = Schema::new(vec![
            primary_text("code"),
            FieldDef {
                name: "category".into(),
                label: "Category".into(),
                field_type: FieldType::Select {
                    options: vec!["a".into(), "b".into()],
                },
                required: false,
                searchable: None,
                primary: false,
                renamed_from: None,
            },
        ]);
        let _ = &mut schema;
        let mut data = EntryData::new();
        data.insert("code".into(), json!("X"));
        data.insert("category".into(), json!("c"));
        let errs = validate(&data, &schema).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, EntryValidationError::InvalidSelectOption(_, _))));
    }

    #[test]
    fn rejects_unknown_field() {
        let schema = Schema::new(vec![primary_text("code")]);
        let mut data = EntryData::new();
        data.insert("code".into(), json!("X"));
        data.insert("random".into(), json!("?"));
        let errs = validate(&data, &schema).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, EntryValidationError::UnknownField(_))));
    }

    #[test]
    fn accepts_underscore_prefixed_keys_as_archived_metadata() {
        let schema = Schema::new(vec![primary_text("code")]);
        let mut data = EntryData::new();
        data.insert("code".into(), json!("X"));
        data.insert("_archived".into(), json!({"legacy": "value"}));
        validate(&data, &schema).unwrap();
    }

    #[test]
    fn accepts_optional_date_in_iso_format_only() {
        let schema = Schema::new(vec![
            primary_text("code"),
            FieldDef {
                name: "issued".into(),
                label: "Issued".into(),
                field_type: FieldType::Date,
                required: false,
                searchable: None,
                primary: false,
                renamed_from: None,
            },
        ]);
        let mut ok = EntryData::new();
        ok.insert("code".into(), json!("X"));
        ok.insert("issued".into(), json!("2026-01-01"));
        validate(&ok, &schema).unwrap();

        let mut bad = EntryData::new();
        bad.insert("code".into(), json!("X"));
        bad.insert("issued".into(), json!("01/01/2026"));
        let errs = validate(&bad, &schema).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, EntryValidationError::WrongType(_, _, _))));
    }
}
