//! Subscribes to `EventBus` and emits every event to the Tauri webview.

use specdex_core::events::EventBus;
use tauri::{AppHandle, Emitter};

pub fn spawn(app: AppHandle, events: &EventBus) {
    let mut rx = events.subscribe();
    // `tauri::async_runtime::spawn` uses Tauri's managed runtime handle, so it
    // is safe to call from `setup` (the main thread) — unlike `tokio::spawn`,
    // which would panic without an entered runtime.
    tauri::async_runtime::spawn(async move {
        while let Ok(event) = rx.recv().await {
            // The frontend listens on a single channel and narrows by the
            // event's serialized `type` tag.
            if let Err(e) = app.emit("specdex://event", &event) {
                tracing::warn!(error = ?e, "failed to forward event to webview");
            }
        }
    });
}
