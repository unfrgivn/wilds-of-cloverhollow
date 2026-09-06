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
FAILED=0
for scenario in "${SCENARIOS[@]}"; do
  scenario_capture="$CAPTURE_ROOT/$scenario"
  mkdir -p "$scenario_capture"
  set +e
  if [[ "$(uname -s)" == "Linux" && -x "$(command -v xvfb-run 2>/dev/null || true)" ]]; then
    xvfb-run -a env CAPTURE_DIR="$scenario_capture" ./tools/ci/run-scenario-rendered.sh "$scenario"
  else
    CAPTURE_DIR="$scenario_capture" ./tools/ci/run-scenario-rendered.sh "$scenario"
  fi
  render_status=$?
  set -e
  if (( render_status != 0 )); then
    echo "[visual-regression] FAILED render: $scenario" >&2
    FAILED=1
  fi
done
for scenario in "${SCENARIOS[@]}"; do
  scenario_capture="$CAPTURE_ROOT/$scenario"
  set +e
  BASELINE_DIR="$BASELINE_DIR" ./tools/ci/diff-visual.sh "$scenario" "$scenario_capture"
  diff_status=$?
  set -e
  if (( diff_status != 0 )); then
    FAILED=1
  fi
done
if (( FAILED != 0 )); then
  echo "[visual-regression] FAIL: one or more rendered scenarios or comparisons failed" >&2
  exit 1
fi
echo "[visual-regression] PASS: ${#SCENARIOS[@]} golden scenarios"
