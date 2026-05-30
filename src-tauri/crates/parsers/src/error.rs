//! `ParseError` lives in `specdex_core::parse` (the ingest consumer owns the
//! abstraction; see that module). Re-exported here so impl modules and
//! downstream callers keep using `specdex_parsers::ParseError`.

pub use specdex_core::parse::{ParseError, Result};
