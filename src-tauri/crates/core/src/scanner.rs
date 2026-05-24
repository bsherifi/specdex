//! Aho-Corasick scanner. §13.

pub mod cache;
pub mod index;
pub mod resolver;

pub use cache::ScanCache;
pub use index::{PatternMeta, PatternSource as ScannerPatternSource, ScanIndex};
pub use resolver::resolve_location;

use std::sync::Arc;
use std::sync::RwLock;

use crate::db::Db;
use crate::models::ids::SourceDocId;
use crate::models::scan::{Match, ScanScope};
use crate::source_doc::SourceDocRepo;
use crate::Result;

/// Top-level scanner. Wraps a (lazily rebuilt) automaton + cache.
pub struct Scanner {
    index: RwLock<Option<Arc<ScanIndex>>>,
    cache: ScanCache,
}

impl Scanner {
    #[must_use]
    pub fn new() -> Self {
        Self {
            index: RwLock::new(None),
            cache: ScanCache::new(),
        }
    }

    pub fn invalidate(&self) {
        *self.index.write().unwrap() = None;
        self.cache.clear();
    }

    pub fn invalidate_doc(&self, doc_id: SourceDocId) {
        self.cache.invalidate_doc(doc_id);
    }

    /// Scans `doc_id` against `scope`. Hits the cache on repeat calls.
    // §10: core fns take owned serde-serializable values, so `scope` is owned
    // even though we only read it here.
    #[allow(clippy::needless_pass_by_value)]
    pub fn scan(&self, db: &Db, doc_id: SourceDocId, scope: ScanScope) -> Result<Vec<Match>> {
        let scope_hash = scope_hash(&scope);
        if let Some(cached) = self.cache.get(doc_id, scope_hash) {
            return Ok((*cached).clone());
        }
        let index = self.ensure_index(db)?;
        let doc = SourceDocRepo::new(db).get(doc_id)?;
        let matches = index.scan(&doc, &scope);
        let arc = Arc::new(matches);
        self.cache.insert(doc_id, scope_hash, arc.clone());
        Ok((*arc).clone())
    }

    fn ensure_index(&self, db: &Db) -> Result<Arc<ScanIndex>> {
        if let Some(idx) = self.index.read().unwrap().clone() {
            return Ok(idx);
        }
        let built = Arc::new(ScanIndex::build_from_db(db)?);
        *self.index.write().unwrap() = Some(built.clone());
        Ok(built)
    }
}

impl Default for Scanner {
    fn default() -> Self {
        Self::new()
    }
}

fn scope_hash(scope: &ScanScope) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    match scope {
        ScanScope::All => 0u64.hash(&mut hasher),
        ScanScope::Only { kb_id } => {
            1u64.hash(&mut hasher);
            kb_id.as_uuid().as_bytes().hash(&mut hasher);
        }
    }
    hasher.finish()
}
