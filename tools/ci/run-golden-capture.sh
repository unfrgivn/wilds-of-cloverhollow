#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-}"
if [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(date +%Y%m%d_%H%M%S)"
fi

GODOT_BIN="${GODOT_BIN:-godot}"
CAPTURE_ROOT="captures/${RUN_ID}"
SEED="${SEED:-0}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-1800}"
FIXED_FPS="${FIXED_FPS:-30}"
RESOLUTION="${RESOLUTION:-1920x1080}"
AUDIO_DRIVER="${AUDIO_DRIVER:-Dummy}"
HEADLESS_MODE="${HEADLESS_MODE:-0}"
HEADLESS_FLAG=""
if [[ "$HEADLESS_MODE" == "1" ]]; then
  HEADLESS_FLAG="--headless"
fi

SCENARIOS=(
  golden_movement
  golden_encounter_trigger
  golden_battle_one_turn
)

mkdir -p "$CAPTURE_ROOT"

for SCENARIO_ID in "${SCENARIOS[@]}"; do
  SCENARIO_DIR="${CAPTURE_ROOT}/${SCENARIO_ID}"
  mkdir -p "$SCENARIO_DIR"
  mkdir -p "$SCENARIO_DIR/movie"
  "$GODOT_BIN" $HEADLESS_FLAG --audio-driver "$AUDIO_DRIVER" --path . --fixed-fps "$FIXED_FPS" --resolution "$RESOLUTION" --write-movie "${SCENARIO_DIR}/movie/frame.png" -- --scenario "$SCENARIO_ID" --capture_dir "$SCENARIO_DIR" --seed "$SEED" --quit_after_frames "$QUIT_AFTER_FRAMES"
done

echo "Golden capture complete. Outputs: $CAPTURE_ROOT"
