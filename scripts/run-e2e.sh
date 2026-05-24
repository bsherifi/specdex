#!/usr/bin/env bash
# Build the Specdex binary in debug mode, then start tauri-driver and run Playwright.
# tauri-driver speaks WebDriver on :4444 and proxies to WebKitWebDriver.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[run-e2e] building debug binary..."
cargo build -p tauri_adapter --manifest-path src-tauri/Cargo.toml

echo "[run-e2e] starting tauri-driver on :4444..."
tauri-driver --native-driver "$(command -v WebKitWebDriver)" --port 4444 &
DRIVER_PID=$!
trap 'echo "[run-e2e] killing tauri-driver $DRIVER_PID"; kill $DRIVER_PID 2>/dev/null || true' EXIT

# Give tauri-driver ~2s to bind. Polling avoids a hard-coded sleep.
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4444/status >/dev/null 2>&1; then
    echo "[run-e2e] tauri-driver up"; break
  fi
  sleep 0.2
done

echo "[run-e2e] running Playwright..."
pnpm exec playwright test "$@"
