//! `ingest_file` — copy → parse → persist → emit. §12.

use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::app_data::AppDataDir;
use crate::db::Db;
use crate::events::EventBus;
use crate::models::event::Event;
use crate::models::ids::{JobId, SourceDocId};
use crate::models::source_document::SourceDocument;
use crate::parse::{DocumentParser, ParseOptions};
use crate::source_doc::{InsertSourceDoc, SourceDocRepo};
use crate::{CoreError, Result};

#[derive(Debug, Clone)]
pub struct IngestArgs {
    pub source_path: PathBuf,
    pub ocr: bool,
    pub job_id: JobId,
    pub identity_name: Option<String>,
}

pub fn ingest_file(
    db: &Db,
    app_data: &AppDataDir,
    parser: &dyn DocumentParser,
    events: &EventBus,
    args: IngestArgs,
) -> Result<SourceDocument> {
    let original_name = args
        .source_path
        .file_name()
        .map_or_else(|| "unknown.pdf".into(), |s| s.to_string_lossy().to_string());

    // 1. Copy file into docs/<doc_id>.pdf.
    let doc_id = SourceDocId::new();
    let ext = args
        .source_path
        .extension()
        .map_or_else(|| "pdf".into(), |s| s.to_string_lossy().to_string());
    let rel = app_data.doc_relative_path(doc_id, &ext);
    let abs = app_data.root().join(&rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::copy(&args.source_path, &abs)?;

    events.emit(Event::IngestProgress {
        job_id: args.job_id,
        progress: 0.1,
    });

    // 2. Hash for diagnostics (§11.1: "for diagnostics; re-ingest always adds as new").
    let hash = sha256_file(&abs)?;

    events.emit(Event::IngestProgress {
        job_id: args.job_id,
        progress: 0.2,
    });

    // 3. Parse.
    let parsed = parser
        .parse(&abs, ParseOptions { ocr: args.ocr })
        .map_err(|e| CoreError::Parse(e.to_string()))?;

    events.emit(Event::IngestProgress {
        job_id: args.job_id,
        progress: 0.8,
    });

    // 4. Persist.
    let repo = SourceDocRepo::new(db);
    let doc = repo.insert(InsertSourceDoc {
        id: doc_id,
        filename: original_name,
        stored_path: rel,
        content_sha256: hash,
        mime_type: "application/pdf".into(),
        page_count: parsed.page_count,
        parsed_text: parsed.text,
        parsed_spans: parsed.spans,
        ocr_used: parsed.ocr_used,
        ingested_by: args.identity_name,
    })?;

    events.emit(Event::IngestComplete {
        job_id: args.job_id,
        source_doc_id: doc.id,
    });

    Ok(doc)
}

fn sha256_file(path: &Path) -> Result<String> {
    let mut hasher = Sha256::new();
    let mut f = std::fs::File::open(path)?;
    std::io::copy(&mut f, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse::ParsedDocument;

    fn write_pdf(tmp: &Path) -> PathBuf {
        let p = tmp.join("spec.pdf");
        std::fs::write(&p, b"%PDF-1.4\n% mock\n").unwrap();
        p
    }

    /// A parser that ignores the path and always returns a fixed document.
    struct AnyPathMock;
    impl DocumentParser for AnyPathMock {
        fn parse(&self, _: &Path, _: ParseOptions) -> crate::parse::Result<ParsedDocument> {
            Ok(ParsedDocument {
                page_count: 1,
                text: "hello world".into(),
                spans: vec![],
                ocr_used: false,
            })
        }
    }

    #[test]
    fn ingest_copies_persists_and_emits_complete() {
        let tmp = tempfile::tempdir().unwrap();
        let app = AppDataDir::new(tmp.path().join("appdata")).unwrap();
        let src = write_pdf(tmp.path());
        let db = Db::open(app.db_path()).unwrap();
        let ev = EventBus::new();
        let mut rx = ev.subscribe();
        let parser = AnyPathMock;
        let doc = ingest_file(
            &db,
            &app,
            &parser,
            &ev,
            IngestArgs {
                source_path: src,
                ocr: false,
                job_id: JobId::new(),
                identity_name: Some("Sara".into()),
            },
        )
        .unwrap();
        assert_eq!(doc.filename, "spec.pdf");
        assert_eq!(doc.parsed_text, "hello world");
        // The copied file exists under docs/.
        assert!(app.root().join(&doc.stored_path).exists());
        // Drain progress events; expect IngestComplete eventually.
        let mut saw_complete = false;
        for _ in 0..10 {
            if let Ok(Event::IngestComplete { .. }) = rx.try_recv() {
                saw_complete = true;
                break;
            }
        }
        assert!(saw_complete);
    }

    #[test]
    fn reingesting_same_path_adds_a_new_row() {
        let tmp = tempfile::tempdir().unwrap();
        let app = AppDataDir::new(tmp.path().join("appdata")).unwrap();
        let src = write_pdf(tmp.path());
        let db = Db::open(app.db_path()).unwrap();
        let ev = EventBus::new();
        let parser = AnyPathMock;
        let make_args = || IngestArgs {
            source_path: src.clone(),
            ocr: false,
            job_id: JobId::new(),
            identity_name: None,
        };
        let a = ingest_file(&db, &app, &parser, &ev, make_args()).unwrap();
        let b = ingest_file(&db, &app, &parser, &ev, make_args()).unwrap();
        assert_ne!(a.id, b.id);
        assert_eq!(SourceDocRepo::new(&db).list_recent(10).unwrap().len(), 2);
    }
}
