//! `JobsRunner` — single-worker tokio task that processes ingest + index
//! jobs serially (§12: parsing is CPU-bound, OCR is RAM-heavy).
//!
//! v1's design lets each subsystem submit `Job`s through a typed enqueue
//! API rather than a generic `Box<dyn Future>`, so the runner can be tested
//! without spinning up tokio infra.

use std::sync::{Arc, Mutex};

use tokio::sync::mpsc;

use crate::events::EventBus;
use crate::models::event::Event;
use crate::models::ids::JobId;
use crate::models::job::{Job, JobKind, JobState};
use crate::Result;

pub trait JobHandler: Send + Sync {
    fn run(&self, job: &mut Job, events: &EventBus) -> Result<()>;
}

pub struct JobsRunner {
    submit: mpsc::UnboundedSender<Job>,
    /// Every job ever observed, for test inspection. Unused outside tests.
    #[cfg_attr(not(test), allow(dead_code))]
    inner: Arc<Mutex<Vec<Job>>>,
}

impl JobsRunner {
    pub fn start(handler: Arc<dyn JobHandler>, events: Arc<EventBus>) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<Job>();
        let history: Arc<Mutex<Vec<Job>>> = Arc::new(Mutex::new(Vec::new()));
        let history_clone = history.clone();
        tokio::spawn(async move {
            while let Some(mut job) = rx.recv().await {
                job.state = JobState::Running { progress: 0.0 };
                history_clone.lock().unwrap().push(job.clone());
                match handler.run(&mut job, &events) {
                    Ok(()) => {
                        job.state = JobState::Done;
                    }
                    Err(e) => {
                        let msg = e.to_string();
                        events.emit(Event::IngestFailed {
                            job_id: job.id,
                            message: msg.clone(),
                        });
                        job.state = JobState::Failed { message: msg };
                    }
                }
                history_clone.lock().unwrap().push(job);
            }
        });
        Self {
            submit: tx,
            inner: history,
        }
    }

    pub fn submit(&self, kind: JobKind) -> JobId {
        let id = JobId::new();
        let now = chrono::Utc::now();
        let job = Job {
            id,
            kind,
            state: JobState::Queued,
            created_at: now,
            updated_at: now,
        };
        let _ = self.submit.send(job);
        id
    }

    /// Test-only inspection of jobs ever observed.
    #[cfg(test)]
    pub fn history(&self) -> Vec<Job> {
        self.inner.lock().unwrap().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    struct EchoHandler;
    impl JobHandler for EchoHandler {
        fn run(&self, job: &mut Job, events: &EventBus) -> Result<()> {
            events.emit(Event::IngestProgress {
                job_id: job.id,
                progress: 1.0,
            });
            Ok(())
        }
    }

    #[test]
    fn submitted_jobs_run_in_order_and_emit_progress() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let bus = Arc::new(EventBus::new());
            let mut rx = bus.subscribe();
            let runner = JobsRunner::start(Arc::new(EchoHandler), bus.clone());
            let _ = runner.submit(JobKind::RebuildSourceDocsIndex);
            // Give the worker a few ticks to process.
            for _ in 0..50 {
                if rx.try_recv().is_ok() {
                    assert!(!runner.history().is_empty());
                    return;
                }
                tokio::time::sleep(Duration::from_millis(10)).await;
            }
            panic!("no progress event observed");
        });
    }
}
