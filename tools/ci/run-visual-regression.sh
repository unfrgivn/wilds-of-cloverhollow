#!/usr/bin/env bash
set -euo pipefail

BASELINE_DIR="${BASELINE_DIR:-baselines/visual}"
CAPTURE_ROOT="${CAPTURE_DIR:-captures/current}"
SCENARIOS=(golden_overworld golden_dialogue golden_battle)

if [[ -e "$CAPTURE_ROOT" && -n "$(find "$CAPTURE_ROOT" -mindepth 1 -print -quit 2>/dev/null)" ]]; then
  echo "ERROR: capture root must be empty: $CAPTURE_ROOT" >&2
  exit 1
fi
mkdir -p "$CAPTURE_ROOT"
for scenario in "${SCENARIOS[@]}"; do
  scenario_capture="$CAPTURE_ROOT/$scenario"
  mkdir -p "$scenario_capture"
  if [[ "$(uname -s)" == "Linux" && -x "$(command -v xvfb-run 2>/dev/null || true)" ]]; then
    xvfb-run -a env CAPTURE_DIR="$scenario_capture" ./tools/ci/run-scenario-rendered.sh "$scenario"
  else
    CAPTURE_DIR="$scenario_capture" ./tools/ci/run-scenario-rendered.sh "$scenario"
  fi
  BASELINE_DIR="$BASELINE_DIR" ./tools/ci/diff-visual.sh "$scenario" "$scenario_capture"
done
echo "[visual-regression] PASS: ${#SCENARIOS[@]} golden scenarios"
