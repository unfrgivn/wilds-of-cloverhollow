#!/usr/bin/env bash
# validate_sprite.sh - Validate a sprite against palette and grid constraints
# Checks: colors match palette, dimensions are multiples of 16

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

usage() {
    echo "Usage: $0 <sprite.png> [--palette <palette.json>] [--grid <size>]"
    echo ""
    echo "Arguments:"
    echo "  sprite.png       - Sprite image to validate"
    echo "  --palette        - Palette file to validate against (optional)"
    echo "  --grid           - Grid size in pixels (default: 16)"
    echo ""
    echo "Example:"
    echo "  $0 art/sprites/player.png --palette art/palettes/cloverhollow.palette.json"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

SPRITE=""
PALETTE=""
GRID_SIZE=16

while [[ $# -gt 0 ]]; do
    case $1 in
        --palette)
            PALETTE="$2"
            shift 2
            ;;
        --grid)
            GRID_SIZE="$2"
            shift 2
            ;;
        -*)
            echo -e "${RED}ERROR:${NC} Unknown option: $1"
            usage
            ;;
        *)
            SPRITE="$1"
            shift
            ;;
    esac
done

if [[ -z "$SPRITE" ]]; then
    echo -e "${RED}ERROR:${NC} No sprite file specified"
    usage
fi

if [[ ! -f "$SPRITE" ]]; then
    echo -e "${RED}ERROR:${NC} Sprite file not found: $SPRITE"
    exit 1
fi

if ! command -v magick &> /dev/null && ! command -v identify &> /dev/null; then
    echo -e "${RED}ERROR:${NC} ImageMagick is required but not installed."
    echo "Install with: brew install imagemagick"
    exit 1
fi

if command -v magick &> /dev/null; then
    IDENTIFY="magick identify"
    CONVERT="magick"
else
    IDENTIFY="identify"
    CONVERT="convert"
fi

echo "=== Validating: $SPRITE ==="

DIMENSIONS=$($IDENTIFY -format "%wx%h" "$SPRITE" 2>/dev/null)
WIDTH=$(echo "$DIMENSIONS" | cut -d'x' -f1)
HEIGHT=$(echo "$DIMENSIONS" | cut -d'x' -f2)

echo "Dimensions: ${WIDTH}x${HEIGHT}"

if [[ $((WIDTH % GRID_SIZE)) -ne 0 ]]; then
    echo -e "${RED}ERROR:${NC} Width ($WIDTH) is not a multiple of $GRID_SIZE"
    ((ERRORS++)) || true
fi

if [[ $((HEIGHT % GRID_SIZE)) -ne 0 ]]; then
    echo -e "${RED}ERROR:${NC} Height ($HEIGHT) is not a multiple of $GRID_SIZE"
    ((ERRORS++)) || true
fi

if [[ -n "$PALETTE" ]]; then
    if [[ ! -f "$PALETTE" ]]; then
        echo -e "${RED}ERROR:${NC} Palette file not found: $PALETTE"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}ERROR:${NC} jq is required for palette validation."
        echo "Install with: brew install jq"
        exit 1
    fi
    
    PALETTE_COLORS=$(jq -r '.colors[]' "$PALETTE" 2>/dev/null | tr '[:upper:]' '[:lower:]')
    SPRITE_COLORS=$($CONVERT "$SPRITE" -format %c -depth 8 histogram:info:- 2>/dev/null | \
        grep -oE '#[0-9A-Fa-f]{6}' | tr '[:upper:]' '[:lower:]' | sort -u)
    
    echo "Palette: $(basename "$PALETTE") ($(echo "$PALETTE_COLORS" | wc -w | tr -d ' ') colors)"
    echo "Sprite colors: $(echo "$SPRITE_COLORS" | wc -w | tr -d ' ')"
    
    for color in $SPRITE_COLORS; do
        if ! echo "$PALETTE_COLORS" | grep -qw "$color"; then
            echo -e "${RED}ERROR:${NC} Color $color not in palette"
            ((ERRORS++)) || true
        fi
    done
fi

echo ""
if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}FAILED:${NC} $ERRORS error(s) found"
    exit 1
else
    echo -e "${GREEN}PASSED:${NC} Sprite is valid"
    exit 0
fi
