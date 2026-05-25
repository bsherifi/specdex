import { listen, type Event as TauriEvent, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "./store";

/**
 * Tauri events arrive as `specdex://event` with the serialized `Event`
 * payload. We narrow by `type` and dispatch into the store.
 */
type SpecdexEvent =
  | { type: "kb_created"; kb_id: string }
  | { type: "kb_updated"; kb_id: string }
  | { type: "kb_deleted"; kb_id: string }
  | { type: "kb_schema_changed"; kb_id: string }
  | { type: "entry_created"; entry_id: string; kb_id: string }
  | { type: "entry_updated"; entry_id: string; kb_id: string }
  | { type: "entry_deleted"; entry_id: string; kb_id: string }
  | { type: "ingest_queued"; job_id: string; filename: string }
  | { type: "ingest_progress"; job_id: string; progress: number }
  | { type: "ingest_complete"; job_id: string; source_doc_id: string }
  | { type: "ingest_failed"; job_id: string; message: string }
  | { type: "scan_cache_invalidated" }
  | { type: "search_index_rebuild_started" }
  | { type: "search_index_rebuild_complete" }
  | { type: "identity_updated" };

export async function subscribeToSpecdexEvents(): Promise<UnlistenFn> {
  return listen<SpecdexEvent>("specdex://event", (e: TauriEvent<SpecdexEvent>) => {
    const ev = e.payload;
    const store = useStore.getState();
    switch (ev.type) {
      case "kb_created":
      case "kb_updated":
      case "kb_deleted":
      case "kb_schema_changed":
        store.bumpKbsStale();
        break;
      case "entry_created":
      case "entry_updated":
      case "entry_deleted":
        store.bumpEntryStale(ev.kb_id);
        break;
      case "ingest_queued":
        store.upsertIngestJob({
          jobId: ev.job_id,
          filename: ev.filename,
          progress: 0,
          state: "queued",
        });
        break;
      case "ingest_progress":
        store.upsertIngestJob({
          jobId: ev.job_id,
          filename: "",
          progress: ev.progress,
          state: "running",
        });
        break;
      case "ingest_complete":
        store.upsertIngestJob({
          jobId: ev.job_id,
          filename: "",
          progress: 1,
          state: "done",
        });
        break;
      case "ingest_failed":
        store.upsertIngestJob({
          jobId: ev.job_id,
          filename: "",
          progress: 0,
          state: "failed",
          message: ev.message,
        });
        break;
      case "identity_updated":
        // Caller decides whether to refetch.
        break;
      default:
        break;
    }
  });
}
