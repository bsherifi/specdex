use std::path::PathBuf;

use specdex_core::ingest::{ingest_file, IngestArgs};
use specdex_core::models::event::Event;
use specdex_core::models::ids::JobId;
use specdex_core::models::source_document::SourceDocument;
use specdex_core::CoreError;

use crate::state::AppState;

#[derive(serde::Deserialize, specta::Type)]
pub struct IngestFilesArgs {
    /// Per-file: absolute path + opt-in OCR flag.
    pub files: Vec<IngestFile>,
}

#[derive(Clone, serde::Deserialize, specta::Type)]
pub struct IngestFile {
    pub path: String,
    pub ocr: bool,
}

#[derive(serde::Serialize, specta::Type)]
pub struct IngestFilesResult {
    pub job_ids: Vec<JobId>,
}

#[tauri::command]
#[specta::specta]
pub fn ingest_files(
    state: tauri::State<'_, AppState>,
    args: IngestFilesArgs,
) -> Result<IngestFilesResult, CoreError> {
    // Files are processed sequentially on a background blocking task per the
    // multi-file semantics in §12: parsing is CPU-bound; OCR is RAM-heavy.
    let job_ids: Vec<JobId> = args.files.iter().map(|_| JobId::new()).collect();

    for (file, job_id) in args.files.iter().zip(job_ids.iter().copied()) {
        state.events.emit(Event::IngestQueued {
            job_id,
            filename: PathBuf::from(&file.path)
                .file_name()
                .map_or_else(|| file.path.clone(), |s| s.to_string_lossy().to_string()),
        });
    }

    let db = state.db.clone();
    let app_data = state.app_data.clone();
    let events = state.events.clone();
    let identity = state.identity();
    let pdfium = state.pdfium_parser.clone();
    let ocr = state.ocr_parser.clone();
    let files = args.files.clone();
    let job_ids_clone = job_ids.clone();
    let scanner = state.scanner.clone();
    let search = state.search.clone();

    tauri::async_runtime::spawn_blocking(move || {
        for (file, job_id) in files.into_iter().zip(job_ids_clone) {
            let parser = if file.ocr {
                ocr.as_ref()
            } else {
                pdfium.as_ref()
            };
            let path = PathBuf::from(&file.path);
            match ingest_file(
                &db,
                &app_data,
                parser,
                &events,
                IngestArgs {
                    source_path: path,
                    ocr: file.ocr,
                    job_id,
                    identity_name: identity.clone(),
                },
            ) {
                Ok(doc) => {
                    if let Err(e) = search.source_docs.upsert(
                        doc.id,
                        &doc.filename,
                        &doc.parsed_text,
                        doc.ingested_at,
                    ) {
                        tracing::warn!(?e, "search index upsert failed");
                    }
                    scanner.invalidate_doc(doc.id);
                }
                Err(e) => {
                    events.emit(Event::IngestFailed {
                        job_id,
                        message: e.to_string(),
                    });
                }
            }
        }
    });

    Ok(IngestFilesResult { job_ids })
}

#[tauri::command]
#[specta::specta]
pub fn source_doc_list_recent(
    state: tauri::State<'_, AppState>,
    limit: u32,
) -> Result<Vec<SourceDocument>, CoreError> {
    specdex_core::source_doc::SourceDocRepo::new(&state.db).list_recent(limit)
}
