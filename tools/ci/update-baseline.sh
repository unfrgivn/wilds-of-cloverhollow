#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
BASELINE_DIR="${BASELINE_DIR:-baselines/visual}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <scenario_id> [capture_dir]"
    echo ""
    echo "Updates baseline images from captured frames."
    echo ""
    echo "Arguments:"
    echo "  scenario_id  - Scenario to update"
    echo "  capture_dir  - Optional: specific capture directory"
    echo "                 (default: most recent in captures/rendered/<scenario_id>/)"
    exit 1
}

if [[ -z "$SCENARIO_ID" ]]; then
    usage
fi

CAPTURE_DIR="${2:-}"
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

BASELINE_SCENARIO_DIR="$BASELINE_DIR/$SCENARIO_ID"
mkdir -p "$BASELINE_SCENARIO_DIR"

echo "=== Updating Baselines ==="
echo "Scenario: $SCENARIO_ID"
echo "From:     $CAPTURE_DIR"
echo "To:       $BASELINE_SCENARIO_DIR"
echo ""

COUNT=0
for capture_file in "$CAPTURE_DIR"/*.png; do
    if [[ ! -f "$capture_file" ]]; then
        continue
    fi
    
    filename=$(basename "$capture_file")
    cp "$capture_file" "$BASELINE_SCENARIO_DIR/$filename"
    echo -e "${GREEN}Updated:${NC} $filename"
    ((COUNT++)) || true
done

echo ""
echo -e "${GREEN}Updated $COUNT baseline image(s)${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} Review the baselines before committing!"
echo "  git diff baselines/visual/$SCENARIO_ID/"
echo "  git add baselines/visual/$SCENARIO_ID/"
