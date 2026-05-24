//! `DocumentParser` — §12 trait.

use std::path::Path;

use crate::error::Result;
use crate::parsed_document::{ParseOptions, ParsedDocument};

pub trait DocumentParser: Send + Sync {
    fn parse(&self, path: &Path, opts: ParseOptions) -> Result<ParsedDocument>;
}
