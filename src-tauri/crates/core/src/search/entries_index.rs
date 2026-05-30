//! Tantivy entries index. §14 entries schema.

use std::path::Path;
use std::sync::Mutex;

use tantivy::{
    collector::TopDocs,
    doc,
    query::QueryParser,
    schema::{Field, Schema, Value as _, FAST, INDEXED, STORED, STRING, TEXT},
    Index, IndexReader, IndexWriter, ReloadPolicy, TantivyDocument,
};

use crate::db::Db;
use crate::models::ids::{EntryId, KbId};
use crate::search::types::EntryHit;
use crate::{CoreError, Result};

const HEAP_BYTES: usize = 64 * 1024 * 1024; // 64 MiB; ample for v1 sizes.

// Field handles mirror the Tantivy schema field names verbatim (incl.
// `searchable_fields`), so we opt out of the field-naming lint.
#[allow(clippy::struct_field_names)]
struct Fields {
    id: Field,
    kb_id: Field,
    kb_name: Field,
    primary_value: Field,
    searchable_fields: Field,
    aliases: Field,
}

pub struct EntriesIndex {
    index: Index,
    reader: IndexReader,
    writer: Mutex<IndexWriter>,
    fields: Fields,
}

impl EntriesIndex {
    pub fn open(path: &Path) -> Result<Self> {
        std::fs::create_dir_all(path)?;
        let mut builder = Schema::builder();
        let id = builder.add_text_field("id", STRING | STORED);
        let kb_id = builder.add_text_field("kb_id", STRING | STORED | FAST);
        let kb_name = builder.add_text_field("kb_name", TEXT | STORED);
        let primary_value = builder.add_text_field("primary_value", TEXT | STORED);
        let searchable_fields = builder.add_text_field("searchable_fields", TEXT);
        let aliases = builder.add_text_field("aliases", TEXT);
        let schema = builder.build();

        let index =
            if Index::exists(&tantivy::directory::MmapDirectory::open(path).map_err(map_err)?)
                .unwrap_or(false)
            {
                Index::open_in_dir(path).map_err(map_err)?
            } else {
                Index::create_in_dir(path, schema).map_err(map_err)?
            };

        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()
            .map_err(map_err)?;
        let writer = index.writer(HEAP_BYTES).map_err(map_err)?;

        let _ = INDEXED;
        Ok(Self {
            index,
            reader,
            writer: Mutex::new(writer),
            fields: Fields {
                id,
                kb_id,
                kb_name,
                primary_value,
                searchable_fields,
                aliases,
            },
        })
    }

    /// Drops the index contents (used by full rebuild).
    pub fn clear(&self) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        w.delete_all_documents().map_err(map_err)?;
        w.commit().map_err(map_err)?;
        Ok(())
    }

    pub fn rebuild_from_db(&self, db: &Db) -> Result<usize> {
        self.clear()?;
        let mut count = 0;
        let rows = db.with(|conn| {
            let mut stmt = conn.prepare(
                "SELECT e.id, e.kb_id, kb.name, e.primary_value, e.data_json, e.aliases_json
                 FROM entries e JOIN knowledge_bases kb ON kb.id = e.kb_id",
            )?;
            let v: Vec<(String, String, String, String, String, String)> = stmt
                .query_map([], |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                })?
                .collect::<rusqlite::Result<_>>()?;
            Ok(v)
        })?;

        let mut w = self.writer.lock().unwrap();
        for (id, kb_id, kb_name, primary_value, data_json, aliases_json) in rows {
            let searchable = flatten_searchable_text(&data_json);
            let aliases = serde_json::from_str::<Vec<String>>(&aliases_json)
                .unwrap_or_default()
                .join(" ");
            w.add_document(doc!(
                self.fields.id => id,
                self.fields.kb_id => kb_id,
                self.fields.kb_name => kb_name,
                self.fields.primary_value => primary_value,
                self.fields.searchable_fields => searchable,
                self.fields.aliases => aliases,
            ))
            .map_err(map_err)?;
            count += 1;
        }
        w.commit().map_err(map_err)?;
        Ok(count)
    }

    /// Upsert one entry. Idempotent via delete-by-id + add.
    pub fn upsert_entry(
        &self,
        entry_id: EntryId,
        kb_id: KbId,
        kb_name: &str,
        primary_value: &str,
        data_json: &str,
        aliases: &[String],
    ) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        let id_term = tantivy::Term::from_field_text(self.fields.id, &entry_id.to_string());
        w.delete_term(id_term);
        w.add_document(doc!(
            self.fields.id => entry_id.to_string(),
            self.fields.kb_id => kb_id.to_string(),
            self.fields.kb_name => kb_name.to_string(),
            self.fields.primary_value => primary_value.to_string(),
            self.fields.searchable_fields => flatten_searchable_text(data_json),
            self.fields.aliases => aliases.join(" "),
        ))
        .map_err(map_err)?;
        w.commit().map_err(map_err)?;
        Ok(())
    }

    pub fn delete_entry(&self, entry_id: EntryId) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        w.delete_term(tantivy::Term::from_field_text(
            self.fields.id,
            &entry_id.to_string(),
        ));
        w.commit().map_err(map_err)?;
        Ok(())
    }

    pub fn delete_kb(&self, kb_id: KbId) -> Result<()> {
        let mut w = self.writer.lock().unwrap();
        w.delete_term(tantivy::Term::from_field_text(
            self.fields.kb_id,
            &kb_id.to_string(),
        ));
        w.commit().map_err(map_err)?;
        Ok(())
    }

    /// Search query — §14: primary^3 + searchable + aliases^2.
    pub fn search(&self, query: &str, limit: usize) -> Result<Vec<EntryHit>> {
        self.reader.reload().ok();
        let searcher = self.reader.searcher();
        let mut parser = QueryParser::for_index(
            &self.index,
            vec![
                self.fields.primary_value,
                self.fields.searchable_fields,
                self.fields.aliases,
            ],
        );
        parser.set_field_boost(self.fields.primary_value, 3.0);
        parser.set_field_boost(self.fields.aliases, 2.0);
        let parsed = parser
            .parse_query(&crate::search::escape_query(query))
            .map_err(|e| CoreError::Search(e.to_string()))?;

        let top = searcher
            .search(&parsed, &TopDocs::with_limit(limit))
            .map_err(map_err)?;
        let mut out = Vec::with_capacity(top.len());
        for (score, address) in top {
            let doc: TantivyDocument = searcher.doc(address).map_err(map_err)?;
            let id_s = field_str(&doc, self.fields.id)
                .ok_or_else(|| CoreError::Search("missing id".into()))?;
            let kb_s = field_str(&doc, self.fields.kb_id)
                .ok_or_else(|| CoreError::Search("missing kb_id".into()))?;
            let entry_id = id_s
                .parse::<EntryId>()
                .map_err(|e| CoreError::Search(e.to_string()))?;
            let kb_id = kb_s
                .parse::<KbId>()
                .map_err(|e| CoreError::Search(e.to_string()))?;
            out.push(EntryHit {
                entry_id,
                kb_id,
                kb_name: field_str(&doc, self.fields.kb_name).unwrap_or_default(),
                primary_value: field_str(&doc, self.fields.primary_value).unwrap_or_default(),
                score,
            });
        }
        Ok(out)
    }
}

fn field_str(doc: &TantivyDocument, field: Field) -> Option<String> {
    doc.get_first(field)
        .and_then(|v| v.as_str().map(str::to_owned))
}

fn flatten_searchable_text(data_json: &str) -> String {
    let v: serde_json::Value = serde_json::from_str(data_json).unwrap_or(serde_json::Value::Null);
    let mut acc = String::new();
    if let serde_json::Value::Object(m) = v {
        for (_k, val) in m {
            if let serde_json::Value::String(s) = val {
                acc.push_str(&s);
                acc.push(' ');
            }
        }
    }
    acc
}

fn map_err<E: std::fmt::Display>(e: E) -> CoreError {
    CoreError::Search(e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rebuild_then_search_finds_by_primary_and_alias() {
        let tmp = tempfile::tempdir().unwrap();
        let db = Db::open_memory().unwrap();
        let kb_id = KbId::new();
        let entry_id = EntryId::new();
        // Seed (ids must be valid UUIDs — search() parses the stored ids back).
        db.with_mut(|c| {
            let now = chrono::Utc::now().to_rfc3339();
            c.execute(
                "INSERT INTO knowledge_bases (id, name, schema_json, primary_field, searchable_fields_json, highlight_color, created_at, updated_at)
                 VALUES (?1, 'Boeing', '[]', 'code', '[]', '#000', ?2, ?2)",
                rusqlite::params![kb_id.to_string(), now],
            )?;
            c.execute(
                "INSERT INTO entries (id, kb_id, primary_value, data_json, aliases_json, created_at, updated_at)
                 VALUES (?1, ?2, 'BAC3082', '{\"code\":\"BAC3082\",\"definition\":\"Surface prep\"}', '[\"BAC-3082\"]', ?3, ?3)",
                rusqlite::params![entry_id.to_string(), kb_id.to_string(), now],
            )?;
            Ok(())
        }).unwrap();

        let idx = EntriesIndex::open(&tmp.path().join("entries")).unwrap();
        let n = idx.rebuild_from_db(&db).unwrap();
        assert_eq!(n, 1);

        let hits = idx.search("BAC3082", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].primary_value, "BAC3082");

        let hits2 = idx.search("BAC-3082", 10).unwrap();
        assert_eq!(hits2.len(), 1);
    }

    #[test]
    fn upsert_then_delete_round_trips() {
        let tmp = tempfile::tempdir().unwrap();
        let idx = EntriesIndex::open(&tmp.path().join("entries")).unwrap();
        let entry_id = EntryId::new();
        let kb_id = KbId::new();
        idx.upsert_entry(entry_id, kb_id, "Boeing", "BAC", "{\"code\":\"BAC\"}", &[])
            .unwrap();
        assert_eq!(idx.search("BAC", 10).unwrap().len(), 1);
        idx.delete_entry(entry_id).unwrap();
        assert!(idx.search("BAC", 10).unwrap().is_empty());
    }
}
