#!/usr/bin/env bash
set -euo pipefail

: "${GODOT_BIN:=godot}"
mkdir -p captures/study-import
import_root="$(mktemp -d "captures/study-import/run.XXXXXX")"
log_file="$import_root/import.log"
run_root="$import_root/runtime"

run_with_watchdog() {
  if command -v gtimeout >/dev/null 2>&1; then gtimeout 120 "$@"
  elif command -v timeout >/dev/null 2>&1; then timeout 120 "$@"
  else perl -e 'alarm shift; exec @ARGV' 120 "$@"; fi
}

echo "[study-import] capture_dir=$import_root"
set +e
GODOT_ISOLATION_ROOT="$run_root" run_with_watchdog ./tools/ci/run-godot-isolated.sh --headless --editor --import --quit 2>&1 | tee "$log_file"
godot_status=${PIPESTATUS[0]}
set -e
if (( godot_status != 0 )); then
  echo "[study-import] ERROR: Godot import exited with status $godot_status" >&2
  exit "$godot_status"
fi
if grep -qE '(^|: )ERROR:|SCRIPT ERROR:|Parse Error:' "$log_file"; then
  echo "[study-import] ERROR: Godot reported import errors, see $log_file" >&2
  exit 1
fi
echo "[study-import] PASS"
