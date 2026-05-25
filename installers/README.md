# Specdex installers

This directory holds platform-specific bundler configuration. Tauri's
configured bundler (see `src-tauri/tauri.conf.json`) drives:

- Windows: MSI via WiX
- macOS: DMG (signed + notarized in CI when secrets are present)
- Linux: AppImage

## Bundling native dependencies

Run `download-pdfium.sh <target>` and `download-ocrs-models.sh` *before*
`cargo tauri build`. The scripts populate `src-tauri/binaries/` which is
referenced by `bundle.resources` in `tauri.conf.json`. ocrs itself is
pure Rust — only the two `.rten` model files need bundling, no native
OCR runtime.

## Signing & notarization

- macOS: set `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_PASSWORD` env vars.
  `cargo tauri build` will sign + notarize automatically.
- Windows: set `TAURI_PRIVATE_KEY` + `TAURI_KEY_PASSWORD` for a code-signing
  cert. The MSI is signed via `signtool` (configured in `tauri.conf.json`).
- Linux: AppImages are unsigned; users verify with the SHA-256 published on
  the GitHub release page.
