//! Tantivy source-docs index. §14 source-docs schema + snippet generator.

use std::path::Path;
use std::sync::Mutex;

use tantivy::{
    collector::TopDocs,
    doc,
    query::QueryParser,
    schema::{DateOptions, Field, Schema, Value as _, STORED, STRING, TEXT},
    Index, IndexReader, IndexWriter, ReloadPolicy, SnippetGenerator, TantivyDocument,
};

use crate::db::Db;
use crate::models::ids::SourceDocId;
use crate::search::types::SourceDocHit;
use crate::{CoreError, Result};

const HEAP_BYTES: usize = 64 * 1024 * 1024;

struct Fields {
    id: Field,
    filename: Field,
    parsed_text: Field,
    ingested_at: Field,
}

pub struct SourceDocsIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    fields: Fields,
}

impl SourceDocsIndex {
    pub fn open(path: &Path) -> Result<Self> {
        std::fs::create_dir_all(path)?;
        let mut builder = Schema::builder();
        let id = builder.add_text_field("id", STRING | STORED);
        let filename = builder.add_text_field("filename", TEXT | STORED);
        let parsed_text = builder.add_text_field("parsed_text", TEXT | STORED);
        let ingested_at = builder.add_date_field(
            "ingested_at",
            DateOptions::default().set_stored().set_indexed(),
        );
        let schema = builder.build();

        let index = match Index::open_in_dir(path) {
            Ok(i) => i,
            Err(_) => Index::create_in_dir(path, schema).map_err(map_err)?,
        };
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(map_err)?;
        let writer = index.writer(HEAP_BYTES).map_err(map_err)?;

        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            fields: Fields {
                id,
                filename,
                parsed_text,
                ingested_at,
            },
        })
    }

    pub fn clear(&self) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        w.delete_all_documents().map_err(map_err)?;
        w.commit().map_err(map_err)?;
        Ok(())
    }

    pub fn rebuild_from_db(&self, db: &Db) -> Result<usize> {
        self.clear()?;
        let rows = db.with(|conn| {
            let mut stmt = conn
                .prepare("SELECT id, filename, parsed_text, ingested_at FROM source_documents")?;
            let v: Vec<(String, String, String, String)> = stmt
                .query_map([], |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })?
                .collect::<rusqlite::Result<_>>()?;
            Ok(v)
        })?;
        let mut w = self.writer.lock().unwrap();
        let mut count = 0;
        for (id, filename, text, ts) in rows {
            let dt: chrono::DateTime<chrono::Utc> = ts
                .parse()
                .map_err(|e: chrono::ParseError| CoreError::Search(e.to_string()))?;
            w.add_document(doc!(
                self.fields.id => id,
                self.fields.filename => filename,
                self.fields.parsed_text => text,
                self.fields.ingested_at => tantivy::DateTime::from_timestamp_secs(dt.timestamp()),
            ))
            .map_err(map_err)?;
            count += 1;
        }
        w.commit().map_err(map_err)?;
        Ok(count)
    }

    pub fn upsert(
        &self,
        id: SourceDocId,
        filename: &str,
        parsed_text: &str,
        ingested_at: chrono::DateTime<chrono::Utc>,
    ) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        w.delete_term(tantivy::Term::from_field_text(
            self.fields.id,
            &id.to_string(),
        ));
        w.add_document(doc!(
            self.fields.id => id.to_string(),
            self.fields.filename => filename.to_string(),
            self.fields.parsed_text => parsed_text.to_string(),
            self.fields.ingested_at => tantivy::DateTime::from_timestamp_secs(ingested_at.timestamp()),
        ))
        .map_err(map_err)?;
        w.commit().map_err(map_err)?;
        Ok(())
    }

    pub fn delete(&self, id: SourceDocId) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        w.delete_term(tantivy::Term::from_field_text(
            self.fields.id,
            &id.to_string(),
        ));
        w.commit().map_err(map_err)?;
        Ok(())
    }

    /// Search + snippet generation.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<SourceDocHit>> {
        self.reader.reload().ok();
        let searcher = self.reader.searcher();
        let mut parser = QueryParser::for_index(
            &self.index,
            vec![self.fields.parsed_text, self.fields.filename],
        );
        parser.set_field_boost(self.fields.filename, 2.0);
        let parsed = parser
            .parse_query(&crate::search::escape_query(query))
            .map_err(|e| CoreError::Search(e.to_string()))?;

        let snippet_gen = SnippetGenerator::create(&searcher, &parsed, self.fields.parsed_text)
            .map_err(map_err)?;

        let top = searcher
            .search(&parsed, &TopDocs::with_limit(limit))
            .map_err(map_err)?;
        let mut out = Vec::with_capacity(top.len());
        for (score, address) in top {
            let doc: TantivyDocument = searcher.doc(address).map_err(map_err)?;
            let id_s = doc
                .get_first(self.fields.id)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let id = id_s
                .parse::<SourceDocId>()
                .map_err(|e| CoreError::Search(e.to_string()))?;
            let filename = doc
                .get_first(self.fields.filename)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let snippet = snippet_gen.snippet_from_doc(&doc).to_html();
            out.push(SourceDocHit {
                source_doc_id: id,
                filename,
                snippet_html: snippet,
                score,
            });
        }
        Ok(out)
    }
}

fn map_err<E: std::fmt::Display>(e: E) -> CoreError {
    CoreError::Search(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upsert_then_search_returns_snippet() {
        let tmp = tempfile::tempdir().unwrap();
        let idx = SourceDocsIndex::open(&tmp.path().join("source_docs")).unwrap();
        let id = SourceDocId::new();
        idx.upsert(
            id,
            "spec.pdf",
            "This PDF defines BAC3082 as a Boeing surface preparation process.",
            chrono::Utc::now(),
        )
        .unwrap();
        let hits = idx.search("BAC3082", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].snippet_html.contains("<b>"));
        assert_eq!(hits[0].filename, "spec.pdf");
    }
}
