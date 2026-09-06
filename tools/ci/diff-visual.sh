#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
BASELINE_DIR="${BASELINE_DIR:-baselines/visual}"
CAPTURE_DIR="${2:-}"

usage() {
    echo "Usage: $0 <scenario_id> [capture_dir]"
    echo ""
    echo "Compares captured frames against baseline images."
    echo ""
    echo "Arguments:"
    echo "  scenario_id  - Scenario to compare"
    echo "  capture_dir  - Optional: specific capture directory to compare"
    echo "                 (default: most recent in captures/rendered/<scenario_id>/)"
    echo ""
    echo "Environment:"
    echo "  BASELINE_DIR - Baseline directory (default: baselines/visual)"
    exit 1
}

if [[ -z "$SCENARIO_ID" ]]; then
    usage
fi

BASELINE_SCENARIO_DIR="$BASELINE_DIR/$SCENARIO_ID"
command -v magick >/dev/null 2>&1 || { echo "ERROR: ImageMagick is required" >&2; exit 1; }

if [[ -z "$CAPTURE_DIR" ]]; then
    CAPTURE_DIR=$(ls -td captures/rendered/"$SCENARIO_ID"/*/ 2>/dev/null | head -1)
    if [[ -z "$CAPTURE_DIR" ]]; then
        echo -e "${RED}ERROR:${NC} No captures found for scenario: $SCENARIO_ID"
        echo "Run scenario first: ./tools/ci/run-scenario-rendered.sh $SCENARIO_ID"
        exit 1
    fi
fi

if [[ ! -d "$CAPTURE_DIR" ]]; then
    echo -e "${RED}ERROR:${NC} Capture directory not found: $CAPTURE_DIR"
    exit 1
fi

DIFF_DIR="${CAPTURE_DIR}/diffs"
mkdir -p "$DIFF_DIR"
exec bun run tools/ci/visual-evidence.ts "$BASELINE_SCENARIO_DIR" "$CAPTURE_DIR" "$DIFF_DIR"
