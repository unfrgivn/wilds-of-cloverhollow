#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-scenario_smoke}"
: "${GODOT_BIN:=godot}"

if ! command -v bun >/dev/null 2>&1; then
  echo "[scenario] ERROR: Bun is required for evidence validation. Install Bun or set PATH." >&2
  exit 1
fi

if [[ -n "${CAPTURE_DIR:-}" ]]; then
  CAPTURE_DIR="$CAPTURE_DIR"
  mkdir -p "$CAPTURE_DIR"
  if [[ -n "$(find "$CAPTURE_DIR" -mindepth 1 -print -quit)" ]]; then
    echo "[scenario] ERROR: capture directory must be empty: $CAPTURE_DIR" >&2
    exit 1
  fi
else
  mkdir -p "captures/scenarios/$SCENARIO_ID"
  CAPTURE_DIR="$(mktemp -d "captures/scenarios/$SCENARIO_ID/run.XXXXXX")"
fi
SEED="${SEED:-12345}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-600}"

LOG_FILE="$CAPTURE_DIR/run.log"
RUN_ROOT="$(cd "$CAPTURE_DIR" && pwd)/runtime"
PERSONAL_MANIFEST_BEFORE="$CAPTURE_DIR/personal-userdata-before.sha256"
PERSONAL_MANIFEST_AFTER="$CAPTURE_DIR/personal-userdata-after.sha256"
./tools/ci/manifest-personal-user-data.sh "$PERSONAL_MANIFEST_BEFORE"

echo "[scenario] id=$SCENARIO_ID"
echo "[scenario] capture_dir=$CAPTURE_DIR"
echo "[scenario] seed=$SEED"

run_with_watchdog() {
  if command -v gtimeout >/dev/null 2>&1; then
    gtimeout 120 "$@"
  elif command -v timeout >/dev/null 2>&1; then
    timeout 120 "$@"
  else
    perl -e 'alarm shift; exec @ARGV' 120 "$@"
  fi
}
set +e
GODOT_ISOLATION_ROOT="$RUN_ROOT" run_with_watchdog ./tools/ci/run-godot-isolated.sh --headless -- --scenario "$SCENARIO_ID" --seed "$SEED" --isolation_root "$RUN_ROOT" --capture_dir "$CAPTURE_DIR" --quit_after_frames "$QUIT_AFTER_FRAMES" 2>&1 | tee "$LOG_FILE"
godot_status=${PIPESTATUS[0]}
set -e
if (( godot_status != 0 )); then
  echo "[scenario] ERROR: Godot exited with status $godot_status" >&2
  exit "$godot_status"
fi
./tools/ci/manifest-personal-user-data.sh "$PERSONAL_MANIFEST_AFTER"
if ! cmp -s "$PERSONAL_MANIFEST_BEFORE" "$PERSONAL_MANIFEST_AFTER"; then
  echo "[scenario] ERROR: personal user data changed during isolated run" >&2
  exit 1
fi
validator_args=(--trace "$CAPTURE_DIR/trace.json" --log "$LOG_FILE" --captures "$CAPTURE_DIR")
if [[ ! -f "tests/scenarios/${SCENARIO_ID}.json" ]]; then
  validator_args+=(--expected-error "Scenario file not found: res://tests/scenarios/${SCENARIO_ID}.json")
fi
if ! bun run tools/ci/validate-scenario.ts "${validator_args[@]}"; then
  exit 1
fi
if grep -qE '(^|: )ERROR:|SCRIPT ERROR:|Parse Error:' "$LOG_FILE"; then
  echo "[scenario] ERROR: Godot reported runtime errors, see $LOG_FILE" >&2
  exit 1
fi
echo "[scenario] PASS"
