#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-}"
if [[ -z "$RUN_ID" ]]; then
  echo "Usage: ./tools/ci/update-visual-baseline.sh <run_id>" >&2
  exit 2
fi

BASELINE_ROOT="${BASELINE_ROOT:-tests/visual-baselines}"
CAPTURE_ROOT="captures/${RUN_ID}"

SCENARIOS=(
  golden_movement
  golden_encounter_trigger
  golden_battle_one_turn
)

for SCENARIO_ID in "${SCENARIOS[@]}"; do
  SRC_DIR="${CAPTURE_ROOT}/${SCENARIO_ID}/movie"
  DEST_DIR="${BASELINE_ROOT}/${SCENARIO_ID}/movie"
  if [[ ! -d "$SRC_DIR" ]]; then
    echo "Missing capture frames: $SRC_DIR" >&2
    exit 1
  fi
  mkdir -p "$DEST_DIR"
  cp -R "$SRC_DIR/". "$DEST_DIR/"
done

echo "Updated visual baselines under ${BASELINE_ROOT}"
