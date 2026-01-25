#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-scenario_smoke}"
: "${GODOT_BIN:=godot}"

CAPTURE_DIR="${CAPTURE_DIR:-captures/scenarios/${SCENARIO_ID}/$(date +%Y%m%d-%H%M%S)}"
SEED="${SEED:-12345}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-600}"

mkdir -p "$CAPTURE_DIR"

echo "[scenario] id=$SCENARIO_ID"
echo "[scenario] capture_dir=$CAPTURE_DIR"
echo "[scenario] seed=$SEED"

"$GODOT_BIN" --path . --headless -- --scenario "$SCENARIO_ID" --seed "$SEED" --capture_dir "$CAPTURE_DIR" --quit_after_frames "$QUIT_AFTER_FRAMES"
