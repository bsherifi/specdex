//! Build script for the `tauri_adapter` binary.
//!
//! SPECDEX-V1.md §9.4 places `tauri.conf.json` at the workspace root
//! (`src-tauri/tauri.conf.json`) rather than next to this crate's Cargo.toml.
//! `tauri-build` reads the config from the build script's current working
//! directory (`tauri_utils::config::parse::read_from(&current_dir)`), which
//! Cargo sets to this crate's manifest dir. We `set_current_dir` to the
//! workspace root so the config is found there. The matching codegen side
//! (`tauri::generate_context!`) is pointed at the same file via an explicit
//! relative path in `main.rs`.

use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // crates/tauri_adapter/ -> crates/ -> src-tauri/
    let workspace_root = manifest_dir
        .parent()
        .and_then(std::path::Path::parent)
        .expect("CARGO_MANIFEST_DIR has unexpected depth")
        .to_path_buf();
    let conf_path = workspace_root.join("tauri.conf.json");

    println!("cargo:rerun-if-changed={}", conf_path.display());
    println!("cargo:rerun-if-changed=build.rs");

    std::env::set_current_dir(&workspace_root).expect("failed to cd to workspace root");

    tauri_build::build();
}
