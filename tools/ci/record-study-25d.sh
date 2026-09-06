#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-study_25d_walk}"
case "$SCENARIO_ID" in study_25d_walk|study_25d_camera) ;; *) echo "[study-record] ERROR: unsupported study scenario: $SCENARIO_ID" >&2; exit 2 ;; esac
./tools/ci/import-study-25d.sh
if [[ -n "${CAPTURE_DIR:-}" ]]; then
  mkdir -p "$CAPTURE_DIR"
  if [[ -n "$(find "$CAPTURE_DIR" -mindepth 1 -print -quit)" ]]; then echo "[study-record] ERROR: capture directory must be empty: $CAPTURE_DIR" >&2; exit 1; fi
else
  mkdir -p "captures/study-record/$SCENARIO_ID"
  CAPTURE_DIR="$(mktemp -d "captures/study-record/$SCENARIO_ID/run.XXXXXX")"
fi
SEED="${SEED:-12345}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-1800}"
LOG_FILE="$CAPTURE_DIR/run.log"
RUN_ROOT="$(cd "$CAPTURE_DIR" && pwd)/runtime"
run_with_watchdog() {
  if command -v gtimeout >/dev/null 2>&1; then gtimeout 120 "$@"
  elif command -v timeout >/dev/null 2>&1; then timeout 120 "$@"
  else perl -e 'alarm shift; exec @ARGV' 120 "$@"; fi
}
echo "[study-record] id=$SCENARIO_ID capture_dir=$CAPTURE_DIR"
set +e
GODOT_ISOLATION_ROOT="$RUN_ROOT" run_with_watchdog ./tools/ci/run-godot-isolated.sh --write-movie "$CAPTURE_DIR/walkthrough.avi" -- --scenario "$SCENARIO_ID" --seed "$SEED" --isolation_root "$RUN_ROOT" --capture_dir "$CAPTURE_DIR" --quit_after_frames "$QUIT_AFTER_FRAMES" 2>&1 | tee "$LOG_FILE"
godot_status=${PIPESTATUS[0]}
set -e
if (( godot_status != 0 )); then echo "[study-record] ERROR: Godot exited with status $godot_status" >&2; exit "$godot_status"; fi
if ! bun run tools/ci/validate-scenario.ts --trace "$CAPTURE_DIR/trace.json" --log "$LOG_FILE" --captures "$CAPTURE_DIR" --rendered; then exit 1; fi
if grep -qE '(^|: )ERROR:|SCRIPT ERROR:|Parse Error:' "$LOG_FILE"; then echo "[study-record] ERROR: Godot reported runtime errors, see $LOG_FILE" >&2; exit 1; fi
if [[ ! -s "$CAPTURE_DIR/walkthrough.avi" ]]; then echo "[study-record] ERROR: movie was not written: $CAPTURE_DIR/walkthrough.avi" >&2; exit 1; fi
echo "[study-record] PASS"
