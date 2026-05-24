//! Integration test: the placeholder binary runs and prints the expected
//! marker. Plan 02 will replace this with a Tauri smoke test.

use std::process::Command;

#[test]
fn placeholder_binary_prints_marker() {
    let output = Command::new(env!("CARGO_BIN_EXE_specdex"))
        .output()
        .expect("failed to execute specdex binary");

    assert!(
        output.status.success(),
        "specdex binary exited non-zero: {output:?}"
    );

    let stdout = String::from_utf8(output.stdout).expect("stdout not utf-8");
    assert!(
        stdout.contains("specdex placeholder"),
        "binary stdout did not contain marker: {stdout:?}"
    );
}
