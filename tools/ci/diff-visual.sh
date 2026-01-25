#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="${1:-}"
BASELINE_DIR="${BASELINE_DIR:-baselines/visual}"
CAPTURE_DIR="${2:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

if ! command -v magick &> /dev/null && ! command -v compare &> /dev/null; then
    echo -e "${RED}ERROR:${NC} ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

if command -v magick &> /dev/null; then
    COMPARE="magick compare"
else
    COMPARE="compare"
fi

BASELINE_SCENARIO_DIR="$BASELINE_DIR/$SCENARIO_ID"
if [[ ! -d "$BASELINE_SCENARIO_DIR" ]]; then
    echo -e "${YELLOW}WARNING:${NC} No baseline found for scenario: $SCENARIO_ID"
    echo "Create baseline with: ./tools/ci/update-baseline.sh $SCENARIO_ID"
    exit 0
fi

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

echo "=== Visual Diff Report ==="
echo "Scenario: $SCENARIO_ID"
echo "Baseline: $BASELINE_SCENARIO_DIR"
echo "Capture:  $CAPTURE_DIR"
echo ""

DIFF_DIR="${CAPTURE_DIR}/diffs"
mkdir -p "$DIFF_DIR"

PASSED=0
FAILED=0
MISSING=0

for baseline_file in "$BASELINE_SCENARIO_DIR"/*.png; do
    if [[ ! -f "$baseline_file" ]]; then
        continue
    fi
    
    filename=$(basename "$baseline_file")
    capture_file="$CAPTURE_DIR/$filename"
    diff_file="$DIFF_DIR/$filename"
    
    if [[ ! -f "$capture_file" ]]; then
        echo -e "${YELLOW}MISSING:${NC} $filename"
        ((MISSING++)) || true
        continue
    fi
    
    result=$($COMPARE -metric AE "$baseline_file" "$capture_file" "$diff_file" 2>&1) || true
    
    if [[ "$result" == "0" ]]; then
        echo -e "${GREEN}MATCH:${NC}   $filename"
        rm -f "$diff_file"
        ((PASSED++)) || true
    else
        echo -e "${RED}DIFF:${NC}    $filename (${result} pixels differ)"
        ((FAILED++)) || true
    fi
done

for capture_file in "$CAPTURE_DIR"/*.png; do
    if [[ ! -f "$capture_file" ]]; then
        continue
    fi
    
    filename=$(basename "$capture_file")
    baseline_file="$BASELINE_SCENARIO_DIR/$filename"
    
    if [[ ! -f "$baseline_file" ]]; then
        echo -e "${YELLOW}NEW:${NC}     $filename (no baseline)"
        ((MISSING++)) || true
    fi
done

echo ""
echo "=== Summary ==="
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo -e "Missing: ${YELLOW}$MISSING${NC}"

if [[ $FAILED -gt 0 ]]; then
    echo ""
    echo -e "${RED}Visual regression detected!${NC}"
    echo "Diff images saved to: $DIFF_DIR"
    echo "To update baselines: ./tools/ci/update-baseline.sh $SCENARIO_ID"
    exit 1
fi

echo ""
echo -e "${GREEN}Visual regression check passed${NC}"
exit 0
