#!/usr/bin/env bash
# quantize_to_palette.sh - Quantize a PNG image to a specified palette
# Uses ImageMagick to remap colors to the nearest palette color

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

usage() {
    echo "Usage: $0 <input.png> <palette.json> [output.png]"
    echo ""
    echo "Arguments:"
    echo "  input.png    - Source image to quantize"
    echo "  palette.json - Palette file (JSON with 'colors' array of hex values)"
    echo "  output.png   - Output file (default: overwrites input)"
    echo ""
    echo "Example:"
    echo "  $0 art/sprites/player.png art/palettes/cloverhollow.palette.json"
    exit 1
}

if [[ $# -lt 2 ]]; then
    usage
fi

INPUT="$1"
PALETTE="$2"
OUTPUT="${3:-$INPUT}"

if [[ ! -f "$INPUT" ]]; then
    echo -e "${RED}ERROR:${NC} Input file not found: $INPUT"
    exit 1
fi

if [[ ! -f "$PALETTE" ]]; then
    echo -e "${RED}ERROR:${NC} Palette file not found: $PALETTE"
    exit 1
fi

if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo -e "${RED}ERROR:${NC} ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}ERROR:${NC} jq is required but not installed."
    echo "Install with: brew install jq"
    exit 1
fi

COLORS=$(jq -r '.colors[]' "$PALETTE" 2>/dev/null)
if [[ -z "$COLORS" ]]; then
    echo -e "${RED}ERROR:${NC} No colors found in palette file"
    exit 1
fi

TEMP_PALETTE=$(mktemp /tmp/palette_XXXXXX.png)
trap "rm -f $TEMP_PALETTE" EXIT

COLOR_ARGS=""
for color in $COLORS; do
    COLOR_ARGS="$COLOR_ARGS xc:$color"
done

if command -v magick &> /dev/null; then
    CONVERT="magick"
else
    CONVERT="convert"
fi

$CONVERT $COLOR_ARGS +append "$TEMP_PALETTE"

$CONVERT "$INPUT" -dither None -remap "$TEMP_PALETTE" "$OUTPUT"

echo -e "${GREEN}OK:${NC} Quantized $INPUT -> $OUTPUT using palette $(basename "$PALETTE")"
