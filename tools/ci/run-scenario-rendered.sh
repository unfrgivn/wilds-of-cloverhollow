#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-scenario_smoke}"
: "${GODOT_BIN:=godot}"

CAPTURE_DIR="${CAPTURE_DIR:-captures/rendered/${SCENARIO_ID}/$(date +%Y%m%d-%H%M%S)}"
SEED="${SEED:-12345}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-600}"

mkdir -p "$CAPTURE_DIR"

echo "[scenario-rendered] id=$SCENARIO_ID"
echo "[scenario-rendered] capture_dir=$CAPTURE_DIR"
echo "[scenario-rendered] seed=$SEED"

# Rendered run (not --headless) so screenshots/frames can be captured.
"$GODOT_BIN" --path . -- --scenario "$SCENARIO_ID" --seed "$SEED" --capture_dir "$CAPTURE_DIR" --quit_after_frames "$QUIT_AFTER_FRAMES"
