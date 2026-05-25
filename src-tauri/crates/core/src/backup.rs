//! Backup + restore (§16) and per-KB JSON export/import.

use std::io::{Read, Seek, Write};
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::app_data::AppDataDir;
use crate::db::Db;
use crate::entry::{CreateEntry, EntryRepo};
use crate::events::EventBus;
use crate::identity::IdentityRepo;
use crate::kb::{CreateKb, KbRepo};
use crate::models::entry::{Entry, SourceRef};
use crate::models::ids::KbId;
use crate::models::kb::Kb;
use crate::source_doc::{InsertSourceDoc, SourceDocRepo};
use crate::{CoreError, Result};

const FORMAT_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct BackupManifest {
    pub format_version: u32,
    pub app_version: String,
    pub created_at: DateTime<Utc>,
    pub identity_display_name: Option<String>,
    pub kb_count: u32,
    pub doc_count: u32,
    pub total_entries: u32,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct KbExport {
    pub format_version: u32,
    pub exported_at: DateTime<Utc>,
    pub kb: Kb,
    pub entries: Vec<Entry>,
}

/// Writes a full backup ZIP to `out_path`. Overwrites if it exists.
pub fn export_full(db: &Db, app_data: &AppDataDir, out_path: &Path) -> Result<BackupManifest> {
    let ev = EventBus::new();
    let kb_repo = KbRepo::new(db, &ev, None);
    let entry_repo = EntryRepo::new(db, &ev, None);
    let doc_repo = SourceDocRepo::new(db);
    let identity_repo = IdentityRepo::new(db, &ev);

    let kbs = kb_repo.list()?;
    let identity = identity_repo.get()?;
    let docs = doc_repo.list_recent(100_000)?;
    let mut total_entries = 0u32;

    let file = std::fs::File::create(out_path)?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    for kb in &kbs {
        let entries = entry_repo.list(crate::entry::ListEntries {
            kb_id: kb.id,
            limit: Some(u32::MAX),
            ..Default::default()
        })?;
        total_entries =
            total_entries.saturating_add(u32::try_from(entries.len()).unwrap_or(u32::MAX));
        let kb_export = KbExport {
            format_version: FORMAT_VERSION,
            exported_at: Utc::now(),
            kb: kb.clone(),
            entries,
        };
        zip.start_file(format!("kbs/{}.json", kb.id), opts)?;
        zip.write_all(serde_json::to_string_pretty(&kb_export)?.as_bytes())?;
    }

    for doc in &docs {
        let abs = app_data.root().join(&doc.stored_path);
        let bytes = std::fs::read(&abs)?;
        zip.start_file(format!("docs/{}.pdf", doc.id), opts)?;
        zip.write_all(&bytes)?;

        let meta = serde_json::json!({
            "id": doc.id,
            "filename": doc.filename,
            "stored_path": doc.stored_path,
            "content_sha256": doc.content_sha256,
            "mime_type": doc.mime_type,
            "page_count": doc.page_count,
            "parsed_text": doc.parsed_text,
            "parsed_spans": doc.parsed_spans,
            "ocr_used": doc.ocr_used,
            "ingested_at": doc.ingested_at,
            "ingested_by": doc.ingested_by,
        });
        zip.start_file(format!("docs/{}.meta.json", doc.id), opts)?;
        zip.write_all(serde_json::to_string_pretty(&meta)?.as_bytes())?;
    }

    // attachments/ — copy everything under the dir.
    let att_dir = app_data.attachments();
    if att_dir.exists() {
        for entry in std::fs::read_dir(&att_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                let bytes = std::fs::read(&path)?;
                let name = path
                    .file_name()
                    .map_or_else(|| "attachment".into(), |s| s.to_string_lossy().to_string());
                zip.start_file(format!("attachments/{name}"), opts)?;
                zip.write_all(&bytes)?;
            }
        }
    }

    let manifest = BackupManifest {
        format_version: FORMAT_VERSION,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        created_at: Utc::now(),
        identity_display_name: identity.map(|i| i.display_name),
        kb_count: u32::try_from(kbs.len()).unwrap_or(u32::MAX),
        doc_count: u32::try_from(docs.len()).unwrap_or(u32::MAX),
        total_entries,
    };
    zip.start_file("manifest.json", opts)?;
    zip.write_all(serde_json::to_string_pretty(&manifest)?.as_bytes())?;
    zip.finish()?;
    Ok(manifest)
}

/// Restores from a backup ZIP. Destructive: wipes `SQLite`, `docs/`, `attachments/`, `tantivy/`.
#[allow(
    clippy::too_many_lines,
    clippy::case_sensitive_file_extension_comparisons
)]
pub fn restore_full(
    db: &Db,
    app_data: &AppDataDir,
    events: &EventBus,
    zip_path: &Path,
) -> Result<BackupManifest> {
    let file = std::fs::File::open(zip_path)?;
    let mut archive = ZipArchive::new(file)?;

    // Read manifest first.
    let manifest: BackupManifest = read_json(&mut archive, "manifest.json")?;
    if manifest.format_version != FORMAT_VERSION {
        return Err(CoreError::Validation(format!(
            "incompatible backup format_version {}; expected {}",
            manifest.format_version, FORMAT_VERSION
        )));
    }

    // Wipe data.
    db.with_mut(|conn| {
        let tx = conn.transaction()?;
        for t in [
            "entries",
            "source_documents",
            "knowledge_bases",
            "schema_history",
            "identity",
            "app_meta",
        ] {
            tx.execute(&format!("DELETE FROM {t}"), [])?;
        }
        tx.commit()?;
        Ok(())
    })?;
    let _ = std::fs::remove_dir_all(app_data.docs());
    let _ = std::fs::remove_dir_all(app_data.attachments());
    let _ = std::fs::remove_dir_all(app_data.tantivy());
    std::fs::create_dir_all(app_data.docs())?;
    std::fs::create_dir_all(app_data.attachments())?;
    std::fs::create_dir_all(app_data.tantivy())?;

    // Restore identity.
    if let Some(name) = &manifest.identity_display_name {
        IdentityRepo::new(db, events).set(name)?;
    }

    // Restore KBs + entries.
    for i in 0..archive.len() {
        let name = archive.by_index(i)?.name().to_string();
        if name.starts_with("kbs/") && name.ends_with(".json") {
            let kb_export: KbExport = read_json(&mut archive, &name)?;
            let kb_repo = KbRepo::new(db, events, manifest.identity_display_name.clone());
            let created = kb_repo.create(CreateKb {
                name: kb_export.kb.name.clone(),
                description: kb_export.kb.description.clone(),
                schema: kb_export.kb.schema.clone(),
                highlight_color: kb_export.kb.highlight_color.clone(),
            })?;
            let entry_repo = EntryRepo::new(db, events, manifest.identity_display_name.clone());
            for e in kb_export.entries {
                entry_repo.create(CreateEntry {
                    kb_id: created.id,
                    data: e.data,
                    aliases: e.aliases,
                    source: e.source,
                    notes: e.notes,
                })?;
            }
        }
    }

    // Restore source docs.
    for i in 0..archive.len() {
        let name = archive.by_index(i)?.name().to_string();
        if name.starts_with("docs/") && name.ends_with(".pdf") {
            let id_str = name.trim_start_matches("docs/").trim_end_matches(".pdf");
            let meta_name = format!("docs/{id_str}.meta.json");
            let mut bytes = Vec::new();
            {
                let mut entry = archive.by_name(&name)?;
                entry.read_to_end(&mut bytes)?;
            }
            let meta: serde_json::Value = read_json(&mut archive, &meta_name)?;
            let stored_path: String = meta["stored_path"].as_str().unwrap_or("").to_string();
            let abs = app_data.root().join(&stored_path);
            if let Some(parent) = abs.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&abs, bytes)?;
            let parsed_spans: Vec<crate::models::source_document::TextSpan> =
                serde_json::from_value(meta["parsed_spans"].clone()).unwrap_or_default();
            SourceDocRepo::new(db).insert(InsertSourceDoc {
                id: meta["id"]
                    .as_str()
                    .unwrap_or("")
                    .parse()
                    .map_err(|e: uuid::Error| CoreError::Db(e.to_string()))?,
                filename: meta["filename"].as_str().unwrap_or("").to_string(),
                stored_path,
                content_sha256: meta["content_sha256"].as_str().unwrap_or("").to_string(),
                mime_type: meta["mime_type"]
                    .as_str()
                    .unwrap_or("application/pdf")
                    .to_string(),
                page_count: u32::try_from(meta["page_count"].as_u64().unwrap_or(1)).unwrap_or(1),
                parsed_text: meta["parsed_text"].as_str().unwrap_or("").to_string(),
                parsed_spans,
                ocr_used: meta["ocr_used"].as_bool().unwrap_or(false),
                ingested_by: meta["ingested_by"].as_str().map(str::to_owned),
            })?;
        }
    }

    // Restore attachments.
    for i in 0..archive.len() {
        let name = archive.by_index(i)?.name().to_string();
        if name.starts_with("attachments/") && !name.ends_with('/') {
            let mut bytes = Vec::new();
            {
                let mut entry = archive.by_name(&name)?;
                entry.read_to_end(&mut bytes)?;
            }
            let stripped = name.trim_start_matches("attachments/");
            let target = app_data.attachments().join(stripped);
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(&target, bytes)?;
        }
    }

    Ok(manifest)
}

/// Per-KB JSON export (no source docs unless caller chooses to bundle them
/// separately — v1 exports just the JSON; ZIP-with-PDFs is v1.1).
pub fn export_kb_json(db: &Db, kb_id: KbId) -> Result<KbExport> {
    let ev = EventBus::new();
    let kb_repo = KbRepo::new(db, &ev, None);
    let entry_repo = EntryRepo::new(db, &ev, None);
    let kb = kb_repo.get(kb_id)?;
    let entries = entry_repo.list(crate::entry::ListEntries {
        kb_id,
        limit: Some(u32::MAX),
        ..Default::default()
    })?;
    Ok(KbExport {
        format_version: FORMAT_VERSION,
        exported_at: Utc::now(),
        kb,
        entries,
    })
}

/// Per-KB JSON import. Non-destructive: imports as a new KB.
pub fn import_kb_json(
    db: &Db,
    events: &EventBus,
    json: &str,
    identity: Option<String>,
) -> Result<Kb> {
    let mut imp: KbExport = serde_json::from_str(json)?;
    if imp.format_version != FORMAT_VERSION {
        return Err(CoreError::Validation(format!(
            "incompatible KB export format_version {}; expected {}",
            imp.format_version, FORMAT_VERSION
        )));
    }
    let kb_repo = KbRepo::new(db, events, identity.clone());

    // Disambiguate name on collision.
    let existing = kb_repo.list()?;
    if existing.iter().any(|k| k.name == imp.kb.name) {
        imp.kb.name = format!("{} (imported)", imp.kb.name);
    }

    let created = kb_repo.create(CreateKb {
        name: imp.kb.name,
        description: imp.kb.description,
        schema: imp.kb.schema,
        highlight_color: imp.kb.highlight_color,
    })?;

    let entry_repo = EntryRepo::new(db, events, identity);
    for e in imp.entries {
        // Drop source_ref (source PDFs aren't bundled in v1's per-KB JSON).
        let with_source: Option<SourceRef> = None;
        entry_repo.create(CreateEntry {
            kb_id: created.id,
            data: e.data,
            aliases: e.aliases,
            source: with_source,
            notes: e.notes,
        })?;
    }
    Ok(created)
}

fn read_json<T, R: Read + Seek>(archive: &mut ZipArchive<R>, name: &str) -> Result<T>
where
    T: serde::de::DeserializeOwned,
{
    let mut entry = archive
        .by_name(name)
        .map_err(|e| CoreError::Internal(format!("entry {name} not in archive: {e}")))?;
    let mut buf = String::new();
    entry.read_to_string(&mut buf)?;
    Ok(serde_json::from_str(&buf)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::kb::CreateKb;
    use crate::models::schema::{FieldDef, FieldType, Schema};

    fn seed(db: &Db, ev: &EventBus, app: &AppDataDir) {
        let kb_repo = KbRepo::new(db, ev, Some("Sara".into()));
        let kb = kb_repo
            .create(CreateKb {
                name: "Boeing".into(),
                description: None,
                schema: Schema::new(vec![FieldDef {
                    name: "code".into(),
                    label: "Code".into(),
                    field_type: FieldType::Text,
                    required: true,
                    searchable: Some(true),
                    primary: true,
                    renamed_from: None,
                }]),
                highlight_color: "#f59e0b".into(),
            })
            .unwrap();
        let mut data = crate::models::entry::EntryData::new();
        data.insert("code".into(), serde_json::json!("BAC3082"));
        EntryRepo::new(db, ev, Some("Sara".into()))
            .create(CreateEntry {
                kb_id: kb.id,
                data,
                aliases: vec!["BAC-3082".into()],
                source: None,
                notes: None,
            })
            .unwrap();
        let _ = app;
    }

    #[test]
    fn full_roundtrip() {
        let tmp = tempfile::tempdir().unwrap();
        let app = AppDataDir::new(tmp.path().join("appdata")).unwrap();
        let ev = EventBus::new();
        let db = Db::open(app.db_path()).unwrap();
        seed(&db, &ev, &app);

        let backup = tmp.path().join("backup.zip");
        let manifest = export_full(&db, &app, &backup).unwrap();
        assert_eq!(manifest.kb_count, 1);
        assert!(backup.exists());

        // Wipe + restore.
        restore_full(&db, &app, &ev, &backup).unwrap();
        let kbs = KbRepo::new(&db, &ev, None).list().unwrap();
        assert_eq!(kbs.len(), 1);
        let entries = EntryRepo::new(&db, &ev, None)
            .list(crate::entry::ListEntries {
                kb_id: kbs[0].id,
                limit: Some(100),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].primary_value, "BAC3082");
    }

    #[test]
    fn kb_json_export_then_import_as_new_kb() {
        let tmp = tempfile::tempdir().unwrap();
        let app = AppDataDir::new(tmp.path().join("appdata")).unwrap();
        let ev = EventBus::new();
        let db = Db::open(app.db_path()).unwrap();
        seed(&db, &ev, &app);
        let kb_id = KbRepo::new(&db, &ev, None).list().unwrap()[0].id;
        let exp = export_kb_json(&db, kb_id).unwrap();
        let json = serde_json::to_string(&exp).unwrap();
        let new_kb = import_kb_json(&db, &ev, &json, None).unwrap();
        assert!(new_kb.name.ends_with("(imported)"));
    }
}
