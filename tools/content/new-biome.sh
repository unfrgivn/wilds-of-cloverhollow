#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

usage() {
    echo "Usage: $0 <biome_id> [biome_name] [biome_type]"
    echo ""
    echo "Arguments:"
    echo "  biome_id    - Lowercase identifier (e.g., bubblegum_bay)"
    echo "  biome_name  - Display name (default: Title Case of biome_id)"
    echo "  biome_type  - Type: town, wilderness, dungeon (default: wilderness)"
    echo ""
    echo "Example:"
    echo "  $0 bubblegum_bay \"Bubblegum Bay\" wilderness"
    exit 1
}

if [[ $# -lt 1 ]]; then
    usage
fi

BIOME_ID="$1"
BIOME_NAME="${2:-$(echo "$BIOME_ID" | sed 's/_/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')}"
BIOME_TYPE="${3:-wilderness}"

echo "[new-biome] Creating biome: $BIOME_ID ($BIOME_NAME, type: $BIOME_TYPE)"

PALETTE_FILE="$PROJECT_ROOT/art/palettes/${BIOME_ID}.palette.json"
BIOME_DATA="$PROJECT_ROOT/game/data/biomes/${BIOME_ID}.json"
ENCOUNTER_DATA="$PROJECT_ROOT/game/data/encounters/${BIOME_ID}.json"
SCENE_DIR="$PROJECT_ROOT/game/scenes/areas"
SCENE_FILE="$SCENE_DIR/Area_${BIOME_ID}.tscn"
ASSET_DIR="$PROJECT_ROOT/game/assets/tilesets/${BIOME_ID}"
SCENARIO_FILE="$PROJECT_ROOT/tests/scenarios/${BIOME_ID}_exploration_smoke.json"
CHECKLIST_FILE="$PROJECT_ROOT/docs/biomes/${BIOME_ID}.md"

mkdir -p "$(dirname "$PALETTE_FILE")"
mkdir -p "$(dirname "$BIOME_DATA")"
mkdir -p "$(dirname "$ENCOUNTER_DATA")"
mkdir -p "$SCENE_DIR"
mkdir -p "$ASSET_DIR"
mkdir -p "$(dirname "$SCENARIO_FILE")"
mkdir -p "$(dirname "$CHECKLIST_FILE")"

if [[ -f "$BIOME_DATA" ]]; then
    echo "[new-biome] ERROR: Biome $BIOME_ID already exists at $BIOME_DATA"
    exit 1
fi

cat > "$PALETTE_FILE" <<EOF
{
  "name": "${BIOME_ID}",
  "version": 1,
  "colors": [
    "#TODO_COLOR_1",
    "#TODO_COLOR_2",
    "#TODO_COLOR_3",
    "#TODO_COLOR_4",
    "#TODO_COLOR_5",
    "#TODO_COLOR_6"
  ]
}
EOF
echo "[new-biome] Created palette: $PALETTE_FILE"

cat > "$BIOME_DATA" <<EOF
{
  "id": "${BIOME_ID}",
  "name": "${BIOME_NAME}",
  "type": "${BIOME_TYPE}",
  "palette": "art/palettes/${BIOME_ID}.palette.json"
}
EOF
echo "[new-biome] Created biome data: $BIOME_DATA"

cat > "$ENCOUNTER_DATA" <<EOF
{
  "biome_id": "${BIOME_ID}",
  "encounter_rate": 0.1,
  "encounters": [
    {
      "enemy_id": "slime",
      "weight": 1.0,
      "min_count": 1,
      "max_count": 2
    }
  ]
}
EOF
echo "[new-biome] Created encounter data: $ENCOUNTER_DATA"

cat > "$SCENARIO_FILE" <<EOF
{
  "scenario_id": "${BIOME_ID}_exploration_smoke",
  "description": "Verify player can explore ${BIOME_NAME} area",
  "actions": [
    {"type": "load_scene", "path": "res://game/scenes/areas/Area_${BIOME_ID}.tscn"},
    {"type": "wait_frames", "frames": 10},
    {"type": "capture", "label": "initial"},
    {"type": "move", "direction": "right", "frames": 30},
    {"type": "capture", "label": "after_move"},
    {"type": "wait_frames", "frames": 5},
    {"type": "capture", "label": "final"}
  ]
}
EOF
echo "[new-biome] Created scenario: $SCENARIO_FILE"

cat > "$CHECKLIST_FILE" <<EOF
# ${BIOME_NAME} Biome Checklist

**Biome ID:** \`${BIOME_ID}\`
**Type:** ${BIOME_TYPE}
**Status:** 🚧 In Progress

## Required Assets

### Palette
- [ ] Define 6-12 biome-specific colors in \`art/palettes/${BIOME_ID}.palette.json\`
- [ ] Colors must complement global_ui_skin palette

### Tileset
- [ ] Create \`game/assets/tilesets/${BIOME_ID}/tileset.png\` (128x128 minimum)
- [ ] All tiles 16x16
- [ ] Quantized to biome + global palette

### Props
- [ ] At least 3 unique props for the biome
- [ ] Stored in \`game/assets/sprites/props/${BIOME_ID}/\`

### Enemies
- [ ] At least 1 unique enemy type
- [ ] Entry in \`game/data/enemies/enemies.json\`
- [ ] Sprite in \`game/assets/sprites/enemies/\`

### Battle Background
- [ ] Create \`game/assets/backgrounds/battle/${BIOME_ID}.png\` (512x288)

## Required Data

### Biome Definition
- [x] \`game/data/biomes/${BIOME_ID}.json\` created

### Encounters
- [x] \`game/data/encounters/${BIOME_ID}.json\` created
- [ ] Configure encounter_rate
- [ ] Add biome-appropriate enemies

## Required Scenes

### Area Scene
- [ ] Create \`game/scenes/areas/Area_${BIOME_ID}.tscn\`
- [ ] Include Player, spawn markers, area transitions
- [ ] At least one enemy spawn
- [ ] At least one interactable (sign/NPC)

## Testing

### Scenario
- [x] \`tests/scenarios/${BIOME_ID}_exploration_smoke.json\` created
- [ ] Scenario runs without errors
- [ ] Captures generated successfully

## Sign-off

- [ ] All checklist items complete
- [ ] Spec.md updated if needed
- [ ] Visual regression baseline captured
EOF
echo "[new-biome] Created checklist: $CHECKLIST_FILE"

echo ""
echo "[new-biome] ✅ Biome scaffolding complete for: $BIOME_ID"
echo ""
echo "Next steps:"
echo "  1. Edit palette colors in: $PALETTE_FILE"
echo "  2. Create area scene: $SCENE_FILE"
echo "  3. Add tileset assets to: $ASSET_DIR/"
echo "  4. Complete checklist in: $CHECKLIST_FILE"
echo "  5. Run scenario: ./tools/ci/run-scenario.sh ${BIOME_ID}_exploration_smoke"
