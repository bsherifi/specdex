#!/usr/bin/env bash
# Download ocrs's text-detection + text-recognition .rten models. ocrs is
# pure Rust so no binary, no language data — just two model files that
# ship under bundle.resources. sha256 digests pinned for reproducibility.
set -euo pipefail

DEST="src-tauri/binaries/ocrs"
mkdir -p "${DEST}"

# Pin to a specific ocrs release. Update these alongside the `ocrs` crate
# version bump in plan 14's Cargo.toml.
BASE_URL="https://ocrs-models.s3-accelerate.amazonaws.com"
DETECTION_FILE="text-detection.rten"
RECOGNITION_FILE="text-recognition.rten"
DETECTION_SHA256="f15cfb56bd02c4bf478a20343986504a1f01e1665c2b3a0ad66340f054b1b5ca"
RECOGNITION_SHA256="e484866d4cce403175bd8d00b128feb08ab42e208de30e42cd9889d8f1735a6e"

download_and_verify() {
  local name="$1"
  local expected_sha="$2"
  local out="${DEST}/${name}"
  # Re-download when the file is missing OR empty (a failed earlier run can
  # leave a 0-byte stub that the app then mistakes for a present model).
  if [ ! -s "${out}" ]; then
    curl -fL "${BASE_URL}/${name}" -o "${out}"
  fi
  if [ ! -s "${out}" ]; then
    echo "download produced an empty file for ${name}" >&2
    exit 1
  fi
  if [ "${expected_sha}" != "REPLACE_WITH_PINNED_SHA256" ]; then
    actual=$(shasum -a 256 "${out}" | awk '{print $1}')
    if [ "${actual}" != "${expected_sha}" ]; then
      echo "sha256 mismatch for ${name}: expected ${expected_sha}, got ${actual}" >&2
      exit 1
    fi
  fi
}

download_and_verify "${DETECTION_FILE}" "${DETECTION_SHA256}"
download_and_verify "${RECOGNITION_FILE}" "${RECOGNITION_SHA256}"
echo "ocrs models in ${DEST}"
