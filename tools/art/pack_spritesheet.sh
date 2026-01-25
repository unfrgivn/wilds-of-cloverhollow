#!/usr/bin/env bash
# pack_spritesheet.sh - Pack individual sprite frames into a spritesheet
# Takes a directory of frames and creates a horizontal strip or grid

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <input_dir> <output.png> [--cols <n>]"
    echo ""
    echo "Arguments:"
    echo "  input_dir   - Directory containing numbered frames (frame_01.png, etc.)"
    echo "  output.png  - Output spritesheet path"
    echo "  --cols      - Number of columns (default: all frames in one row)"
    echo ""
    echo "Example:"
    echo "  $0 art/sprites/player/walk/ art/sprites/player_walk.png --cols 4"
    exit 1
}

if [[ $# -lt 2 ]]; then
    usage
fi

INPUT_DIR=""
OUTPUT=""
COLS=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --cols)
            COLS="$2"
            shift 2
            ;;
        -*)
            echo -e "${RED}ERROR:${NC} Unknown option: $1"
            usage
            ;;
        *)
            if [[ -z "$INPUT_DIR" ]]; then
                INPUT_DIR="$1"
            elif [[ -z "$OUTPUT" ]]; then
                OUTPUT="$1"
            fi
            shift
            ;;
    esac
done

if [[ -z "$INPUT_DIR" ]] || [[ -z "$OUTPUT" ]]; then
    echo -e "${RED}ERROR:${NC} Missing required arguments"
    usage
fi

if [[ ! -d "$INPUT_DIR" ]]; then
    echo -e "${RED}ERROR:${NC} Input directory not found: $INPUT_DIR"
    exit 1
fi

if ! command -v magick &> /dev/null && ! command -v montage &> /dev/null; then
    echo -e "${RED}ERROR:${NC} ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

if command -v magick &> /dev/null; then
    MONTAGE="magick montage"
else
    MONTAGE="montage"
fi

FRAMES=$(find "$INPUT_DIR" -maxdepth 1 -name "*.png" | sort)
FRAME_COUNT=$(echo "$FRAMES" | wc -l | tr -d ' ')

if [[ $FRAME_COUNT -eq 0 ]]; then
    echo -e "${RED}ERROR:${NC} No PNG files found in $INPUT_DIR"
    exit 1
fi

echo "Found $FRAME_COUNT frames in $INPUT_DIR"

if [[ $COLS -eq 0 ]]; then
    COLS=$FRAME_COUNT
fi

ROWS=$(( (FRAME_COUNT + COLS - 1) / COLS ))

echo "Creating ${COLS}x${ROWS} spritesheet..."

$MONTAGE $FRAMES -tile "${COLS}x${ROWS}" -geometry +0+0 -background none "$OUTPUT"

echo -e "${GREEN}OK:${NC} Created spritesheet: $OUTPUT"
