#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
BASELINE_DIR="${BASELINE_DIR:-baselines/visual}"
CAPTURE_DIR="${2:-${CAPTURE_DIR:-}}"
if [[ -z "$SCENARIO_ID" ]]; then
  echo "Usage: $0 <scenario_id> [capture_dir]" >&2
  exit 2
fi
if [[ -z "$CAPTURE_DIR" ]]; then
  CAPTURE_DIR=$(find "captures/rendered/$SCENARIO_ID" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort | tail -1)
fi
exec "$(dirname "$0")/diff-visual.sh" "$SCENARIO_ID" "$CAPTURE_DIR"
