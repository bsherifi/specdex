//! Specdex parsers crate — owns the `DocumentParser` trait and its
//! implementations (`PdfiumParser`, `OcrParser`, mock).
//!
//! Trait + impls land in plan 14. See SPECDEX-V1.md §12.

pub const CRATE_NAME: &str = "specdex_parsers";

#[cfg(test)]
mod tests {
    use super::CRATE_NAME;

    #[test]
    fn crate_name_is_set() {
        assert_eq!(CRATE_NAME, "specdex_parsers");
    }
}
