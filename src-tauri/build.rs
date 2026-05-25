//! Build script for the Specdex Tauri binary.
//!
//! `tauri.conf.json` lives beside this crate's `Cargo.toml` at `src-tauri/`
//! (the canonical Tauri layout), so `tauri-build` finds it in the build
//! script's default working directory — no path redirection needed.

fn main() {
    tauri_build::build();
}
