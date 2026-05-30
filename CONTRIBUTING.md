# Contributing

Thank you for considering contributing to Specdex.

## Setup

```bash
git clone https://github.com/bsherifi/specdex
cd specdex
pnpm install
./installers/download-pdfium.sh linux
./installers/download-ocrs-models.sh
```

## Development loop

```bash
pnpm tauri:dev          # dev with HMR
pnpm test               # frontend tests
pnpm test:e2e           # E2E
cargo test --workspace --manifest-path src-tauri/Cargo.toml
```

## Code style

- Rust: `cargo fmt`, `cargo clippy -- -D warnings`.
- TS: ESLint + Prettier (`pnpm lint && pnpm format`).

## Pull request expectations

- One feature/fix per PR.
- Tests for new behavior.
- CI must be green.

## Architecture

tl;dr: business logic lives in `specdex_core`; the Tauri adapter is thin; v1.1
will add an HTTP adapter alongside without core changes.
