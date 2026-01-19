#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
if [[ -z "$SCENARIO_ID" ]]; then
  echo "Usage: ./tools/ci/run-scenario.sh <scenario_id>" >&2
  exit 2
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
CAPTURE_DIR="${CAPTURE_DIR:-captures/${SCENARIO_ID}/${TIMESTAMP}}"
SEED="${SEED:-12345}"
QUIT_AFTER_FRAMES="${QUIT_AFTER_FRAMES:-1800}"

mkdir -p "$CAPTURE_DIR"

# Note: `--` separates Godot args from project args.

godot --headless --path . -- --scenario "$SCENARIO_ID" --capture_dir "$CAPTURE_DIR" --seed "$SEED" --quit_after_frames "$QUIT_AFTER_FRAMES"

echo "Scenario complete. Outputs: $CAPTURE_DIR"
