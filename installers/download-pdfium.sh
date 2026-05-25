#!/usr/bin/env bash
# Download PDFium prebuilts from the bblanchon/pdfium-binaries release feed.
# Usage: ./installers/download-pdfium.sh [linux|macos-arm|macos-x64|windows-x64]
set -euo pipefail

PDFIUM_VERSION="chromium/6694"
TARGET="${1:-linux}"
DEST="src-tauri/binaries/pdfium/${TARGET}"

mkdir -p "${DEST}"

case "${TARGET}" in
  linux)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION//\//-}/pdfium-linux-x64.tgz"
    ;;
  macos-arm)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION//\//-}/pdfium-mac-arm64.tgz"
    ;;
  macos-x64)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION//\//-}/pdfium-mac-x64.tgz"
    ;;
  windows-x64)
    url="https://github.com/bblanchon/pdfium-binaries/releases/download/${PDFIUM_VERSION//\//-}/pdfium-win-x64.tgz"
    ;;
  *)
    echo "Unknown target: ${TARGET}" >&2
    exit 1
    ;;
esac

curl -L "${url}" -o "${DEST}/pdfium.tgz"
tar -xzf "${DEST}/pdfium.tgz" -C "${DEST}"
rm "${DEST}/pdfium.tgz"
echo "PDFium for ${TARGET} extracted into ${DEST}"
