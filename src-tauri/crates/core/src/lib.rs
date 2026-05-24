//! Specdex core library — business logic for KBs, entries, schemas, ingest,
//! scanning, search, backup, identity, events, and jobs.
//!
//! No transport (Tauri/HTTP) types live here. See SPECDEX-V1.md §10.

/// Crate identifier used by the workspace smoke test (plan 01).
/// Replaced by real exports in plan 10.
pub const CRATE_NAME: &str = "specdex_core";

#[cfg(test)]
mod tests {
    use super::CRATE_NAME;

    #[test]
    fn crate_name_is_set() {
        assert_eq!(CRATE_NAME, "specdex_core");
    }
}
