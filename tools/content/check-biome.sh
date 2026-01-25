#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

usage() {
    echo "Usage: $0 <biome_id>"
    echo ""
    echo "Validates that all required files exist for a biome."
    echo "Returns 0 if complete, 1 if incomplete."
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

BIOME_ID="$1"
ERRORS=0

check_file() {
    local file="$1"
    local desc="$2"
    if [[ -f "$file" ]]; then
        echo "  ✅ $desc"
    else
        echo "  ❌ $desc (missing: $file)"
        ERRORS=$((ERRORS + 1))
    fi
}

check_dir_not_empty() {
    local dir="$1"
    local desc="$2"
    if [[ -d "$dir" ]] && [[ -n "$(ls -A "$dir" 2>/dev/null)" ]]; then
        echo "  ✅ $desc"
    else
        echo "  ❌ $desc (empty or missing: $dir)"
        ERRORS=$((ERRORS + 1))
    fi
}

check_json_valid() {
    local file="$1"
    local desc="$2"
    if [[ -f "$file" ]]; then
        if python3 -c "import json; json.load(open('$file'))" 2>/dev/null; then
            echo "  ✅ $desc"
        else
            echo "  ❌ $desc (invalid JSON: $file)"
            ERRORS=$((ERRORS + 1))
        fi
    fi
}

check_palette_no_todos() {
    local file="$1"
    if [[ -f "$file" ]]; then
        if grep -q "TODO" "$file"; then
            echo "  ❌ Palette has TODO placeholders"
            ERRORS=$((ERRORS + 1))
        else
            echo "  ✅ Palette colors defined"
        fi
    fi
}

echo "[biome-check] Validating biome: $BIOME_ID"
echo ""

echo "📁 Data Files:"
check_file "$PROJECT_ROOT/game/data/biomes/${BIOME_ID}.json" "Biome definition"
check_json_valid "$PROJECT_ROOT/game/data/biomes/${BIOME_ID}.json" "Biome JSON valid"
check_file "$PROJECT_ROOT/game/data/encounters/${BIOME_ID}.json" "Encounter table"
check_json_valid "$PROJECT_ROOT/game/data/encounters/${BIOME_ID}.json" "Encounters JSON valid"
echo ""

echo "🎨 Art Assets:"
check_file "$PROJECT_ROOT/art/palettes/${BIOME_ID}.palette.json" "Palette file"
check_palette_no_todos "$PROJECT_ROOT/art/palettes/${BIOME_ID}.palette.json"
check_dir_not_empty "$PROJECT_ROOT/game/assets/tilesets/${BIOME_ID}" "Tileset directory"
check_file "$PROJECT_ROOT/game/assets/backgrounds/battle/${BIOME_ID}.png" "Battle background"
echo ""

echo "🎬 Scenes:"
check_file "$PROJECT_ROOT/game/scenes/areas/Area_${BIOME_ID}.tscn" "Area scene"
echo ""

echo "🧪 Testing:"
check_file "$PROJECT_ROOT/tests/scenarios/${BIOME_ID}_exploration_smoke.json" "Exploration scenario"
echo ""

echo "📋 Documentation:"
check_file "$PROJECT_ROOT/docs/biomes/${BIOME_ID}.md" "Biome checklist"
echo ""

if [[ $ERRORS -eq 0 ]]; then
    echo "[biome-check] ✅ Biome $BIOME_ID is complete!"
    exit 0
else
    echo "[biome-check] ❌ Biome $BIOME_ID has $ERRORS missing/invalid items"
    exit 1
fi
