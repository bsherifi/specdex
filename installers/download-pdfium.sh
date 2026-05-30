#!/usr/bin/env bash
# Download PDFium prebuilts from the bblanchon/pdfium-binaries release feed.
# Usage: ./installers/download-pdfium.sh [linux|macos-arm|macos-x64|windows-x64]
set -euo pipefail

# Release tags on bblanchon/pdfium-binaries are literally `chromium/NNNN`
# (the slash is part of the tag and must be preserved in the URL).
PDFIUM_VERSION="chromium/7857"
TARGET="${1:-linux}"
DEST="src-tauri/binaries/pdfium/${TARGET}"

mkdir -p "${DEST}"

case "${TARGET}" in
  linux)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION}/pdfium-linux-x64.tgz"
    ;;
  macos-arm)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION}/pdfium-mac-arm64.tgz"
    ;;
  macos-x64)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION}/pdfium-mac-x64.tgz"
    ;;
  windows-x64)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION}/pdfium-win-x64.tgz"
    ;;
  *)
    echo "Unknown target: ${TARGET}" >&2
    exit 1
    ;;
esac

curl -fL "${url}" -o "${DEST}/pdfium.tgz"
# Guard: a 404/HTML body or truncated download must fail loudly, never leave a
# stub that later masquerades as a present-but-broken library.
if ! tar -tzf "${DEST}/pdfium.tgz" >/dev/null 2>&1; then
  echo "Download did not produce a valid gzip tarball (got $(wc -c < "${DEST}/pdfium.tgz") bytes from ${url})" >&2
  rm -f "${DEST}/pdfium.tgz"
  exit 1
fi
tar -xzf "${DEST}/pdfium.tgz" -C "${DEST}"
rm "${DEST}/pdfium.tgz"
echo "PDFium for ${TARGET} extracted into ${DEST}"
