#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
if [[ -z "$SCENARIO_ID" ]]; then
  echo "Usage: ./tools/ci/run-scenario-rendered.sh <scenario_id>" >&2
  exit 2
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
CAPTURE_DIR="${CAPTURE_DIR:-captures/${SCENARIO_ID}/${TIMESTAMP}}"
SEED="${SEED:-12345}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-1800}"
FIXED_FPS="${FIXED_FPS:-30}"
RESOLUTION="${RESOLUTION:-1920x1080}"
GODOT_BIN="${GODOT_BIN:-godot}"
HEADLESS_MODE="${HEADLESS_MODE:-0}"
HEADLESS_FLAG=""
AUDIO_DRIVER="${AUDIO_DRIVER:-Dummy}"
if [[ "$HEADLESS_MODE" == "1" ]]; then
  HEADLESS_FLAG="--headless"
fi

mkdir -p "$CAPTURE_DIR"
mkdir -p "$CAPTURE_DIR/movie"

"$GODOT_BIN" $HEADLESS_FLAG --audio-driver "$AUDIO_DRIVER" --path . --fixed-fps "$FIXED_FPS" --resolution "$RESOLUTION" --write-movie "${CAPTURE_DIR}/movie/frame.png" -- --scenario "$SCENARIO_ID" --capture_dir "$CAPTURE_DIR" --seed "$SEED" --quit_after_frames "$QUIT_AFTER_FRAMES"

echo "Rendered scenario complete. Outputs: $CAPTURE_DIR"
