//! `SourceDocRepo` — CRUD for `source_documents` (§11.1).

use chrono::Utc;
use rusqlite::{params, OptionalExtension};

use crate::db::Db;
use crate::models::ids::SourceDocId;
use crate::models::source_document::{SourceDocument, TextSpan};
use crate::{CoreError, Result};

pub struct SourceDocRepo<'db> {
    db: &'db Db,
}

#[derive(Debug, Clone)]
pub struct InsertSourceDoc {
    pub id: SourceDocId,
    pub filename: String,
    pub stored_path: String,
    pub content_sha256: String,
    pub mime_type: String,
    pub page_count: u32,
    pub parsed_text: String,
    pub parsed_spans: Vec<TextSpan>,
    pub ocr_used: bool,
    pub ingested_by: Option<String>,
}

impl<'db> SourceDocRepo<'db> {
    pub fn new(db: &'db Db) -> Self {
        Self { db }
    }

    pub fn insert(&self, args: InsertSourceDoc) -> Result<SourceDocument> {
        let now = Utc::now();
        let now_s = now.to_rfc3339();
        let spans_json = serde_json::to_string(&args.parsed_spans)?;
        self.db.with_mut(|conn| {
            conn.execute(
                "INSERT INTO source_documents
                  (id, filename, stored_path, content_sha256, mime_type,
                   page_count, parsed_text, parsed_spans_json, ocr_used,
                   ingested_at, ingested_by)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    args.id.to_string(),
                    args.filename,
                    args.stored_path,
                    args.content_sha256,
                    args.mime_type,
                    args.page_count,
                    args.parsed_text,
                    spans_json,
                    i64::from(args.ocr_used),
                    now_s,
                    args.ingested_by,
                ],
            )?;
            Ok(())
        })?;
        Ok(SourceDocument {
            id: args.id,
            filename: args.filename,
            stored_path: args.stored_path,
            content_sha256: args.content_sha256,
            mime_type: args.mime_type,
            page_count: args.page_count,
            parsed_text: args.parsed_text,
            parsed_spans: args.parsed_spans,
            ocr_used: args.ocr_used,
            ingested_at: now,
            ingested_by: args.ingested_by,
        })
    }

    pub fn find(&self, id: SourceDocId) -> Result<Option<SourceDocument>> {
        self.db.with(|conn| {
            let row = conn
                .query_row(SELECT_DOC, [id.to_string()], map_row)
                .optional()?;
            Ok(row)
        })
    }

    pub fn get(&self, id: SourceDocId) -> Result<SourceDocument> {
        self.find(id)?
            .ok_or_else(|| CoreError::NotFound(format!("source_doc={id}")))
    }

    pub fn list_recent(&self, limit: u32) -> Result<Vec<SourceDocument>> {
        self.db.with(|conn| {
            let mut stmt = conn.prepare(&format!(
                "{SELECT_DOC_WITHOUT_WHERE} ORDER BY ingested_at DESC LIMIT {limit}"
            ))?;
            let rows = stmt
                .query_map([], map_row)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows)
        })
    }

    pub fn delete(&self, id: SourceDocId) -> Result<()> {
        self.db.with_mut(|conn| {
            let affected = conn.execute(
                "DELETE FROM source_documents WHERE id = ?1",
                [id.to_string()],
            )?;
            if affected == 0 {
                return Err(CoreError::NotFound(format!("source_doc={id}")));
            }
            Ok(())
        })?;
        Ok(())
    }
}

const SELECT_DOC: &str = "
SELECT id, filename, stored_path, content_sha256, mime_type,
       page_count, parsed_text, parsed_spans_json, ocr_used,
       ingested_at, ingested_by
FROM source_documents WHERE id = ?1";

const SELECT_DOC_WITHOUT_WHERE: &str = "
SELECT id, filename, stored_path, content_sha256, mime_type,
       page_count, parsed_text, parsed_spans_json, ocr_used,
       ingested_at, ingested_by
FROM source_documents";

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SourceDocument> {
    let convert = |e: Box<dyn std::error::Error + Send + Sync>| -> rusqlite::Error {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, e)
    };
    let id: String = row.get(0)?;
    let id = id
        .parse::<SourceDocId>()
        .map_err(|e| convert(Box::new(e)))?;
    let spans_json: String = row.get(7)?;
    let parsed_spans: Vec<TextSpan> =
        serde_json::from_str(&spans_json).map_err(|e| convert(Box::new(e)))?;
    let ocr_used: i64 = row.get(8)?;
    let ingested_at: String = row.get(9)?;
    let ingested_at = ingested_at
        .parse::<chrono::DateTime<chrono::Utc>>()
        .map_err(|e| convert(Box::new(e)))?;
    Ok(SourceDocument {
        id,
        filename: row.get(1)?,
        stored_path: row.get(2)?,
        content_sha256: row.get(3)?,
        mime_type: row.get(4)?,
        page_count: row.get(5)?,
        parsed_text: row.get(6)?,
        parsed_spans,
        ocr_used: ocr_used != 0,
        ingested_at,
        ingested_by: row.get(10)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::source_document::BBox;

    #[test]
    fn insert_then_find_round_trips() {
        let db = Db::open_memory().unwrap();
        let repo = SourceDocRepo::new(&db);
        let id = SourceDocId::new();
        let doc = repo
            .insert(InsertSourceDoc {
                id,
                filename: "spec.pdf".into(),
                stored_path: "docs/abc.pdf".into(),
                content_sha256: "0".repeat(64),
                mime_type: "application/pdf".into(),
                page_count: 3,
                parsed_text: "hello world".into(),
                parsed_spans: vec![TextSpan {
                    start_offset: 0,
                    end_offset: 5,
                    page: 1,
                    bbox: BBox::new(0.0, 0.0, 50.0, 12.0),
                }],
                ocr_used: false,
                ingested_by: Some("Sara".into()),
            })
            .unwrap();
        assert_eq!(doc.filename, "spec.pdf");
        let fetched = repo.find(id).unwrap().unwrap();
        assert_eq!(fetched.page_count, 3);
        assert_eq!(fetched.parsed_spans.len(), 1);
    }

    #[test]
    fn list_recent_orders_by_ingested_at_desc() {
        let db = Db::open_memory().unwrap();
        let repo = SourceDocRepo::new(&db);
        let mut ids = Vec::new();
        for name in ["a.pdf", "b.pdf", "c.pdf"] {
            ids.push(
                repo.insert(InsertSourceDoc {
                    id: SourceDocId::new(),
                    filename: name.into(),
                    stored_path: format!("docs/{name}"),
                    content_sha256: "0".repeat(64),
                    mime_type: "application/pdf".into(),
                    page_count: 1,
                    parsed_text: name.into(),
                    parsed_spans: vec![],
                    ocr_used: false,
                    ingested_by: None,
                })
                .unwrap()
                .id,
            );
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
        let recent = repo.list_recent(10).unwrap();
        assert_eq!(recent[0].id, ids[2]);
        assert_eq!(recent[2].id, ids[0]);
    }
}
