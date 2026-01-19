#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-}"
if [[ -z "$RUN_ID" ]]; then
  echo "Usage: ./tools/ci/run-visual-diff.sh <run_id>" >&2
  exit 2
fi

GODOT_BIN="${GODOT_BIN:-godot}"
BASELINE_ROOT="${BASELINE_ROOT:-tests/visual-baselines}"
CAPTURE_ROOT="captures/${RUN_ID}"
REPORT_DIR="reports/visual-diff/${RUN_ID}"

mkdir -p "$REPORT_DIR"

"$GODOT_BIN" --headless --path . --script res://tools/visual/visual_diff.gd -- --baseline_root "$BASELINE_ROOT" --actual_root "$CAPTURE_ROOT" --report_dir "$REPORT_DIR"

echo "Visual diff report: ${REPORT_DIR}/index.html"
