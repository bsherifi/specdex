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
- Update `SPECDEX-V1.md` if you change a locked v1 contract.
- CI must be green.

## Architecture

See [§10](SPECDEX-V1.md#10-the-api-shaped-discipline-and-why-v11-team-mode-is-cheap)
of the spec. tl;dr: business logic in `specdex_core`; thin Tauri adapter; v1.1
will add an HTTP adapter alongside without core changes.
