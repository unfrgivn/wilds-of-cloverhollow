#!/usr/bin/env bash
set -euo pipefail

: "${GODOT_BIN:=godot}"

echo "[smoke] Using GODOT_BIN=$GODOT_BIN"

# Basic smoke: run for a short time then quit.
# Note: on some setups you may need to replace GODOT_BIN with the full path to the Godot executable.
"$GODOT_BIN" --version >/dev/null 2>&1 || {
  echo "[smoke] ERROR: Godot not found. Set GODOT_BIN to your Godot executable."
  exit 1
}

# Run the project briefly and keep the log, so startup failures cannot be hidden.
log_file="${SMOKE_LOG:-captures/smoke.log}"
mkdir -p "$(dirname "$log_file")"
smoke_root="$(cd "$(dirname "$log_file")" && pwd)/smoke-runtime"
if ! GODOT_ISOLATION_ROOT="$smoke_root" ./tools/ci/run-godot-isolated.sh --headless --quit-after 1 2>&1 | tee "$log_file"; then
  echo "[smoke] ERROR: Godot exited unsuccessfully" >&2
  exit 1
fi
if grep -q '^ERROR:' "$log_file"; then
  echo "[smoke] ERROR: Godot reported runtime errors, see $log_file" >&2
  exit 1
fi

echo "[smoke] OK"
