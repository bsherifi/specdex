//! `ScanCache` — keyed by `(doc_id, scope_hash)`. §13.

use std::sync::Arc;

use dashmap::DashMap;

use crate::models::ids::SourceDocId;
use crate::models::scan::Match;

#[derive(Default)]
pub struct ScanCache {
    inner: DashMap<(SourceDocId, u64), Arc<Vec<Match>>>,
}

impl ScanCache {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn get(&self, doc_id: SourceDocId, scope_hash: u64) -> Option<Arc<Vec<Match>>> {
        self.inner.get(&(doc_id, scope_hash)).map(|e| e.clone())
    }

    pub fn insert(&self, doc_id: SourceDocId, scope_hash: u64, matches: Arc<Vec<Match>>) {
        self.inner.insert((doc_id, scope_hash), matches);
    }

    pub fn clear(&self) {
        self.inner.clear();
    }

    pub fn invalidate_doc(&self, doc_id: SourceDocId) {
        self.inner.retain(|(d, _), _| *d != doc_id);
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.inner.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.inner.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalidate_doc_drops_only_that_docs_entries() {
        let cache = ScanCache::new();
        let d1 = SourceDocId::new();
        let d2 = SourceDocId::new();
        cache.insert(d1, 0, Arc::new(vec![]));
        cache.insert(d2, 0, Arc::new(vec![]));
        cache.invalidate_doc(d1);
        assert!(cache.get(d1, 0).is_none());
        assert!(cache.get(d2, 0).is_some());
    }

    #[test]
    fn clear_drops_everything() {
        let cache = ScanCache::new();
        cache.insert(SourceDocId::new(), 0, Arc::new(vec![]));
        cache.clear();
        assert!(cache.is_empty());
    }
}
