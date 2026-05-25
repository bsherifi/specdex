# Specdex

**A local-first, schema-driven knowledge base for manufacturing engineers.**
PDFs go in; highlighted, source-backed entries come out. Fully offline,
single signed binary per OS, MIT-licensed.

![Specdex viewer with highlighted codes](docs/screenshots/viewer.png)

[Watch a 90-second demo →](docs/screencast.mp4)

## Why Specdex

Specs and codes — `BAC3082`, `AMS-C-5541`, internal part numbers — live
buried in PDFs across SharePoint and network drives. Engineers spend ten
minutes per code hunting for definitions; the codes drift across spellings;
tribal knowledge walks out the door with retirees.

Specdex lets a team curate one or more **knowledge bases** of these codes —
each with its own schema — by highlighting text in source PDFs. After
curation, every lookup is a sub-second database hit, and new documents are
auto-highlighted when they reference known codes.

**v1 is single-user, single-machine, fully offline, no AI.** v1.1 adds LAN
team-mode via shared-secret auth (~3 weekends of additive work on top of v1's
API-shaped backend).

## Hard constraints

- No AI. No telemetry. No outbound network requests.
- No fuzzy matching — aliases are explicit.
- MIT license; no GPL/AGPL/LGPL dependencies linked into the binary.
- Single signed binary per OS — no Python/Java/Node runtime needed.
- Your data is portable: full backup as ZIP, per-KB JSON export.

See [SPECDEX-V1.md](SPECDEX-V1.md) for the full design spec.

## Install

Download the signed installer for your OS from the [releases page](https://github.com/bsherifi/specdex/releases).

- **Windows**: `Specdex_*.msi` (Windows 10 1809+).
- **macOS**: `Specdex_*.dmg` (signed + notarized, universal binary).
- **Linux**: `Specdex_*.AppImage`.

## First-run flow

1. Open Specdex.
2. The onboarding wizard asks for your display name and walks you through
   creating your first knowledge base from a template (Boeing Specs,
   Material Codes, Internal Part Numbers, or Empty).
3. Drag PDFs onto the app. Specdex parses them and scans for codes you've
   already defined.

See [Flow B (ingest a document and create entries)](SPECDEX-V1.md#flow-b-ingest-a-document-and-create-entries)
for the end-to-end loop.

## Example knowledge bases

Three starter KBs ship under `examples/kbs/`. Import via Settings → "Import
KB JSON" or KB list → "Import" once Specdex is open.

## Build from source

```bash
git clone https://github.com/bsherifi/specdex
cd specdex

pnpm install
./installers/download-pdfium.sh linux      # or macos-arm, windows-x64
./installers/download-ocrs-models.sh

pnpm tauri:dev      # dev mode
pnpm tauri build    # production bundle for this OS
```

Requires Rust 1.85+ (managed via rustup; pinned in `rust-toolchain.toml`)
and Node 22+.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The architecture is API-shaped
([§10 of the spec](SPECDEX-V1.md#10-the-api-shaped-discipline-and-why-v11-team-mode-is-cheap))
so most features land as one core function + one Tauri command + one React
route. Test coverage is non-negotiable; CI gates on `cargo test`,
`pnpm test`, `cargo clippy -- -D warnings`, `pnpm lint`, and Playwright E2E
on Linux.

## Roadmap

| Version | Highlights |
|---|---|
| **v1** (current) | Single user. PDF only. Solo workflow. |
| **v1.1** | LAN team-mode (host/client/solo). DOCX + XLSX. Region capture. OCR text-overlay. |
| **v2** | Global hotkey. Browser extension. Folder watch. Opt-in LLM assist for non-primary fields. |

The full breakdown is in [§5](SPECDEX-V1.md#5-whats-in-v1-and-whats-deferred)
and [§23](SPECDEX-V1.md#23-v11-deferred-features).

## License

MIT. Third-party licenses bundled with the binary at
[`THIRD-PARTY-LICENSES.txt`](THIRD-PARTY-LICENSES.txt).

## Acknowledgements

- [pdfium-render](https://github.com/ajrcarey/pdfium-render) + PDFium (Apache 2.0 / BSD-3) for PDF parsing.
- [ocrs](https://github.com/robertknight/ocrs) (MIT / Apache 2.0) for pure-Rust OCR.
- [Tantivy](https://github.com/quickwit-oss/tantivy) (MIT) for full-text search.
- [Tauri](https://tauri.app) (MIT/Apache 2.0) for the desktop shell.
- shadcn/ui (MIT) and Radix UI (MIT) for the UI primitives.
