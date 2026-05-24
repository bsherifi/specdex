//! Schema definitions, field types, and schema diffs.
//!
//! Implements SPECDEX-V1.md §11.3 (field types + constraints) and §15
//! (schema diff structure).

use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashSet;

/// Set of field types Specdex supports in v1. See §11.3.
///
/// `entry_link` is intentionally absent — deferred to v1.1 per §11.3.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum FieldType {
    Text,
    TextMultiline,
    Number,
    Date,
    Select { options: Vec<String> },
    Url,
    ImageAttachment,
}

impl FieldType {
    #[must_use]
    pub fn is_text_like(&self) -> bool {
        matches!(self, Self::Text | Self::TextMultiline)
    }
}

/// One field in a KB schema.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct FieldDef {
    pub name: String,
    pub label: String,
    #[serde(rename = "type")]
    pub field_type: FieldType,
    #[serde(default)]
    pub required: bool,
    /// `None` = use the default for this field type (`text`/`text_multiline` → true, else false).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub searchable: Option<bool>,
    /// Exactly one field per schema has `primary == true`. Validated by
    /// `Schema::validate`.
    #[serde(default)]
    pub primary: bool,
    /// Rename hint from the schema editor. Consumed by `diff()` then cleared
    /// before persistence.
    #[serde(
        default,
        rename = "_renamed_from",
        skip_serializing_if = "Option::is_none"
    )]
    pub renamed_from: Option<String>,
}

impl FieldDef {
    #[must_use]
    pub fn effective_searchable(&self) -> bool {
        self.searchable
            .unwrap_or_else(|| self.field_type.is_text_like())
    }
}

/// A KB's schema — an ordered list of field definitions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(transparent)]
pub struct Schema {
    pub fields: Vec<FieldDef>,
}

impl Schema {
    #[must_use]
    pub fn new(fields: Vec<FieldDef>) -> Self {
        Self { fields }
    }

    /// Returns the primary field, or `None` if invariants are violated.
    #[must_use]
    pub fn primary(&self) -> Option<&FieldDef> {
        self.fields.iter().find(|f| f.primary)
    }

    pub fn validate(&self) -> Result<(), SchemaValidationError> {
        if self.fields.is_empty() {
            return Err(SchemaValidationError::Empty);
        }
        let primary_count = self.fields.iter().filter(|f| f.primary).count();
        if primary_count != 1 {
            return Err(SchemaValidationError::PrimaryCount(primary_count));
        }
        let primary = self.fields.iter().find(|f| f.primary).unwrap();
        if !matches!(primary.field_type, FieldType::Text) {
            return Err(SchemaValidationError::PrimaryNotText(primary.name.clone()));
        }
        let mut seen = HashSet::new();
        for f in &self.fields {
            if !is_snake_case(&f.name) {
                return Err(SchemaValidationError::NotSnakeCase(f.name.clone()));
            }
            if !seen.insert(f.name.clone()) {
                return Err(SchemaValidationError::Duplicate(f.name.clone()));
            }
            if f.label.trim().is_empty() {
                return Err(SchemaValidationError::EmptyLabel(f.name.clone()));
            }
            if let FieldType::Select { options } = &f.field_type {
                if options.is_empty() {
                    return Err(SchemaValidationError::SelectWithoutOptions(f.name.clone()));
                }
                let mut opt_seen = HashSet::new();
                for o in options {
                    if !opt_seen.insert(o.clone()) {
                        return Err(SchemaValidationError::DuplicateSelectOption(
                            f.name.clone(),
                            o.clone(),
                        ));
                    }
                }
            }
        }
        Ok(())
    }

    #[must_use]
    pub fn searchable_field_names(&self) -> Vec<String> {
        self.fields
            .iter()
            .filter(|f| f.effective_searchable())
            .map(|f| f.name.clone())
            .collect()
    }
}

fn is_snake_case(s: &str) -> bool {
    !s.is_empty()
        && s.chars().next().is_some_and(|c| c.is_ascii_lowercase())
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
        && !s.contains("__")
        && !s.ends_with('_')
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type, thiserror::Error)]
#[serde(tag = "code", content = "data")]
pub enum SchemaValidationError {
    #[error("schema has no fields")]
    Empty,
    #[error("schema must have exactly one primary field; found {0}")]
    PrimaryCount(usize),
    #[error("primary field `{0}` must be of type `text`")]
    PrimaryNotText(String),
    #[error("field name `{0}` is not snake_case")]
    NotSnakeCase(String),
    #[error("duplicate field name `{0}`")]
    Duplicate(String),
    #[error("field `{0}` has empty label")]
    EmptyLabel(String),
    #[error("select field `{0}` has no options")]
    SelectWithoutOptions(String),
    #[error("select field `{0}` has duplicate option `{1}`")]
    DuplicateSelectOption(String, String),
}

/// Result of comparing two schemas — produced by `diff()`. Drives the
/// migration-confirm modal (§15) and the migration executor (plan 12).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct SchemaDiff {
    pub added: Vec<FieldDef>,
    pub removed: Vec<FieldDef>,
    /// (`old_name`, `new_def`). New def carries `renamed_from` cleared.
    pub renamed: Vec<(String, FieldDef)>,
    pub type_changed: Vec<(FieldDef, FieldDef)>,
    pub primary_changed: Option<(String, String)>,
    pub options_changed: Vec<(FieldDef, FieldDef)>,
}

impl SchemaDiff {
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.added.is_empty()
            && self.removed.is_empty()
            && self.renamed.is_empty()
            && self.type_changed.is_empty()
            && self.primary_changed.is_none()
            && self.options_changed.is_empty()
    }

    #[must_use]
    pub fn requires_rescan(&self) -> bool {
        self.primary_changed.is_some()
            || !self.renamed.is_empty() && self.renamed.iter().any(|(_, new)| new.primary)
    }
}

/// Computes the diff between two schemas. `new` may carry `renamed_from`
/// hints on fields; this function consumes them.
#[must_use]
pub fn diff(old: &Schema, new: &Schema) -> SchemaDiff {
    let mut added = Vec::new();
    let mut removed = Vec::new();
    let mut renamed: Vec<(String, FieldDef)> = Vec::new();
    let mut type_changed = Vec::new();
    let mut options_changed = Vec::new();

    let old_by_name: std::collections::HashMap<&str, &FieldDef> =
        old.fields.iter().map(|f| (f.name.as_str(), f)).collect();
    let mut new_seen_old_names: HashSet<&str> = HashSet::new();

    for new_field in &new.fields {
        if let Some(rename_src) = &new_field.renamed_from {
            if let Some(old_field) = old_by_name.get(rename_src.as_str()) {
                let mut cleared = new_field.clone();
                cleared.renamed_from = None;
                renamed.push((rename_src.clone(), cleared.clone()));
                new_seen_old_names.insert(rename_src.as_str());
                if std::mem::discriminant(&old_field.field_type)
                    != std::mem::discriminant(&cleared.field_type)
                {
                    type_changed.push(((*old_field).clone(), cleared.clone()));
                } else if let (
                    FieldType::Select { options: oo },
                    FieldType::Select { options: no },
                ) = (&old_field.field_type, &cleared.field_type)
                {
                    if oo != no {
                        options_changed.push(((*old_field).clone(), cleared));
                    }
                }
                continue;
            }
        }
        match old_by_name.get(new_field.name.as_str()) {
            None => {
                let mut cleared = new_field.clone();
                cleared.renamed_from = None;
                added.push(cleared);
            }
            Some(old_field) => {
                new_seen_old_names.insert(new_field.name.as_str());
                if std::mem::discriminant(&old_field.field_type)
                    != std::mem::discriminant(&new_field.field_type)
                {
                    type_changed.push(((*old_field).clone(), new_field.clone()));
                } else if let (
                    FieldType::Select { options: oo },
                    FieldType::Select { options: no },
                ) = (&old_field.field_type, &new_field.field_type)
                {
                    if oo != no {
                        options_changed.push(((*old_field).clone(), new_field.clone()));
                    }
                }
            }
        }
    }

    for old_field in &old.fields {
        if !new_seen_old_names.contains(old_field.name.as_str()) {
            removed.push(old_field.clone());
        }
    }

    let primary_changed = match (old.primary(), new.primary()) {
        (Some(o), Some(n)) if o.name != n.name => Some((o.name.clone(), n.name.clone())),
        _ => None,
    };

    SchemaDiff {
        added,
        removed,
        renamed,
        type_changed,
        primary_changed,
        options_changed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn primary_text(name: &str) -> FieldDef {
        FieldDef {
            name: name.into(),
            label: name.to_uppercase(),
            field_type: FieldType::Text,
            required: true,
            searchable: Some(true),
            primary: true,
            renamed_from: None,
        }
    }

    fn text(name: &str) -> FieldDef {
        FieldDef {
            name: name.into(),
            label: name.to_uppercase(),
            field_type: FieldType::Text,
            required: false,
            searchable: None,
            primary: false,
            renamed_from: None,
        }
    }

    #[test]
    fn validate_requires_one_primary_text_field() {
        let s = Schema::new(vec![primary_text("code"), text("note")]);
        assert!(s.validate().is_ok());
    }

    #[test]
    fn validate_rejects_zero_primaries() {
        let s = Schema::new(vec![text("a")]);
        assert!(matches!(
            s.validate(),
            Err(SchemaValidationError::PrimaryCount(0))
        ));
    }

    #[test]
    fn validate_rejects_non_snake_case() {
        let s = Schema::new(vec![FieldDef {
            name: "Code".into(),
            ..primary_text("code")
        }]);
        assert!(matches!(
            s.validate(),
            Err(SchemaValidationError::NotSnakeCase(_))
        ));
    }

    #[test]
    fn validate_rejects_primary_non_text() {
        let mut p = primary_text("code");
        p.field_type = FieldType::Number;
        let s = Schema::new(vec![p]);
        assert!(matches!(
            s.validate(),
            Err(SchemaValidationError::PrimaryNotText(_))
        ));
    }

    #[test]
    fn validate_rejects_empty_select_options() {
        let mut s = Schema::new(vec![
            primary_text("code"),
            FieldDef {
                field_type: FieldType::Select { options: vec![] },
                ..text("category")
            },
        ]);
        s.fields[1].field_type = FieldType::Select { options: vec![] };
        assert!(matches!(
            s.validate(),
            Err(SchemaValidationError::SelectWithoutOptions(_))
        ));
    }

    #[test]
    fn diff_detects_add_remove_rename_type_change_primary_change() {
        let old = Schema::new(vec![primary_text("code"), text("notes"), text("legacy")]);
        let new = Schema::new(vec![
            // `code` was renamed to `part_number`; carries the hint.
            FieldDef {
                name: "part_number".into(),
                label: "Part number".into(),
                field_type: FieldType::Text,
                required: true,
                searchable: Some(true),
                primary: true,
                renamed_from: Some("code".into()),
            },
            text("notes"),    // unchanged
            text("customer"), // added
        ]);
        let d = diff(&old, &new);
        assert_eq!(d.renamed.len(), 1);
        assert_eq!(d.renamed[0].0, "code");
        assert_eq!(d.renamed[0].1.name, "part_number");
        assert_eq!(
            d.added.iter().map(|f| f.name.clone()).collect::<Vec<_>>(),
            vec!["customer"]
        );
        assert_eq!(
            d.removed.iter().map(|f| f.name.clone()).collect::<Vec<_>>(),
            vec!["legacy"]
        );
        assert_eq!(
            d.primary_changed,
            Some(("code".into(), "part_number".into()))
        );
    }

    #[test]
    fn diff_detects_select_options_change() {
        let mut old_cat = text("category");
        old_cat.field_type = FieldType::Select {
            options: vec!["a".into(), "b".into()],
        };
        let mut new_cat = old_cat.clone();
        new_cat.field_type = FieldType::Select {
            options: vec!["a".into(), "b".into(), "c".into()],
        };
        let old = Schema::new(vec![primary_text("code"), old_cat]);
        let new = Schema::new(vec![primary_text("code"), new_cat]);
        let d = diff(&old, &new);
        assert_eq!(d.options_changed.len(), 1);
    }

    #[test]
    fn searchable_defaults_text_true_number_false() {
        let mut s = Schema::new(vec![
            primary_text("code"),
            FieldDef {
                searchable: None,
                ..text("note")
            },
            FieldDef {
                searchable: None,
                field_type: FieldType::Number,
                ..text("qty")
            },
        ]);
        assert!(s.fields[0].effective_searchable());
        assert!(s.fields[1].effective_searchable());
        assert!(!s.fields[2].effective_searchable());
        s.fields[2].searchable = Some(true);
        assert!(s.fields[2].effective_searchable());
    }
}
