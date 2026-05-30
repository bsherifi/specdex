//! Tokio broadcast wrapper. `EventBus` is `Clone`-cheap; share freely.
//!
//! Per SPECDEX-V1.md §10 rule 7, `core` exposes a `broadcast::Receiver<Event>`
//! that adapters subscribe to. v1's `tauri_adapter` forwards every event to
//! `app.emit_all()`; v1.1's `http_adapter` will additionally fan out to
//! WebSocket clients.

use tokio::sync::broadcast;

use crate::models::event::Event;

const DEFAULT_CAPACITY: usize = 256;

#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<Event>,
}

impl EventBus {
    #[must_use]
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(DEFAULT_CAPACITY);
        Self { tx }
    }

    pub fn emit(&self, event: Event) {
        // Send failures occur only when no receivers exist, which is fine —
        // events that nobody is listening to are dropped on the floor.
        let _ = self.tx.send(event);
    }

    #[must_use]
    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.tx.subscribe()
    }

    #[must_use]
    pub fn receiver_count(&self) -> usize {
        self.tx.receiver_count()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::ids::KbId;

    #[test]
    fn emit_reaches_every_subscriber() {
        // Synchronous `try_recv`: a broadcast buffers each sent value per
        // subscriber, so no async runtime is needed to observe it.
        let bus = EventBus::new();
        let mut r1 = bus.subscribe();
        let mut r2 = bus.subscribe();
        let kb_id = KbId::new();
        bus.emit(Event::KbCreated { kb_id });
        assert_eq!(r1.try_recv().unwrap(), Event::KbCreated { kb_id });
        assert_eq!(r2.try_recv().unwrap(), Event::KbCreated { kb_id });
    }

    #[test]
    fn emit_without_subscribers_does_not_panic() {
        let bus = EventBus::new();
        bus.emit(Event::ScanCacheInvalidated);
    }
}
