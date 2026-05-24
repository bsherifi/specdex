//! Background job tracking (§9.1 `core::jobs`).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::ids::JobId;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum JobState {
    Queued,
    Running { progress: f32 },
    Done,
    Failed { message: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum JobKind {
    IngestFile { filename: String, ocr: bool },
    RebuildEntriesIndex { kb_id: super::ids::KbId },
    RebuildSourceDocsIndex,
    RescanAllDocs,
    SchemaMigration { kb_id: super::ids::KbId },
    Restore,
    Backup,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct Job {
    pub id: JobId,
    pub kind: JobKind,
    pub state: JobState,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn job_round_trips_through_json() {
        let j = Job {
            id: JobId::new(),
            kind: JobKind::IngestFile {
                filename: "spec.pdf".into(),
                ocr: false,
            },
            state: JobState::Running { progress: 0.5 },
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        let s = serde_json::to_string(&j).unwrap();
        let back: Job = serde_json::from_str(&s).unwrap();
        assert_eq!(back.id, j.id);
    }
}
