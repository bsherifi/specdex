//! Domain events broadcast by core subsystems (§10 rule 7).
//!
//! Adapter layer (plan 20) forwards these to `tauri::AppHandle::emit` and
//! v1.1 will forward to WebSocket clients with no shape change.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::ids::{EntryId, JobId, KbId, SourceDocId};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    KbCreated {
        kb_id: KbId,
    },
    KbUpdated {
        kb_id: KbId,
    },
    KbDeleted {
        kb_id: KbId,
    },
    KbSchemaChanged {
        kb_id: KbId,
    },

    EntryCreated {
        entry_id: EntryId,
        kb_id: KbId,
    },
    EntryUpdated {
        entry_id: EntryId,
        kb_id: KbId,
    },
    EntryDeleted {
        entry_id: EntryId,
        kb_id: KbId,
    },

    IngestQueued {
        job_id: JobId,
        filename: String,
    },
    IngestProgress {
        job_id: JobId,
        progress: f32,
    },
    IngestComplete {
        job_id: JobId,
        source_doc_id: SourceDocId,
    },
    IngestFailed {
        job_id: JobId,
        message: String,
    },

    ScanCacheInvalidated,
    SearchIndexRebuildStarted,
    SearchIndexRebuildComplete,

    IdentityUpdated,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_round_trips_through_json() {
        let e = Event::EntryCreated {
            entry_id: EntryId::new(),
            kb_id: KbId::new(),
        };
        let s = serde_json::to_string(&e).unwrap();
        let back: Event = serde_json::from_str(&s).unwrap();
        assert_eq!(back, e);
    }
}
