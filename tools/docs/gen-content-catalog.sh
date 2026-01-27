#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/game/data"

echo "# Game Content Catalog"
echo ""
echo "Auto-generated catalog of game content from data files."
echo ""
echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "---"
echo ""

echo "## Enemies"
echo ""
echo "| ID | Name | HP | MP | ATK | DEF | SPD |"
echo "|---|---|---|---|---|---|---|"
if [[ -f "$DATA_DIR/enemies/enemies.json" ]]; then
    jq -r '.enemies[] | "| `\(.id)` | \(.name) | \(.max_hp) | \(.max_mp) | \(.attack) | \(.defense) | \(.speed) |"' "$DATA_DIR/enemies/enemies.json"
fi
echo ""

echo "## Items"
echo ""
echo "| ID | Name | Type | Effect | Power | Price |"
echo "|---|---|---|---|---|---|"
if [[ -f "$DATA_DIR/items/items.json" ]]; then
    jq -r '.items[] | "| `\(.id)` | \(.name) | \(.type) | \(.effect // "-") | \(.power // "-") | \(.price // "-") |"' "$DATA_DIR/items/items.json"
fi
echo ""

echo "## Skills"
echo ""
echo "| ID | Name | Type | MP Cost | Power | Target | Element |"
echo "|---|---|---|---|---|---|---|"
if [[ -f "$DATA_DIR/skills/skills.json" ]]; then
    jq -r '.skills[] | "| `\(.id)` | \(.name) | \(.type) | \(.mp_cost) | \(.power // "-") | \(.target) | \(.element // "-") |"' "$DATA_DIR/skills/skills.json"
fi
echo ""

echo "## Equipment"
echo ""
echo "| ID | Name | Slot | ATK+ | DEF+ | SPD+ | Price |"
echo "|---|---|---|---|---|---|---|"
if [[ -f "$DATA_DIR/equipment/equipment.json" ]]; then
    jq -r '.equipment[] | "| `\(.id)` | \(.name) | \(.slot) | \(.attack_bonus // 0) | \(.defense_bonus // 0) | \(.speed_bonus // 0) | \(.price // "-") |"' "$DATA_DIR/equipment/equipment.json"
fi
echo ""

echo "## Party Members"
echo ""
echo "| ID | Name | Role | HP | MP | ATK | DEF | SPD |"
echo "|---|---|---|---|---|---|---|---|"
if [[ -f "$DATA_DIR/party/party.json" ]]; then
    jq -r '.members[] | "| `\(.id)` | \(.name) | \(.role) | \(.max_hp) | \(.max_mp) | \(.attack) | \(.defense) | \(.speed) |"' "$DATA_DIR/party/party.json"
fi
echo ""

echo "## Quests"
echo ""
echo "| ID | Name | Type | Reward (Gold) |"
echo "|---|---|---|---|"
if [[ -f "$DATA_DIR/quests/quests.json" ]]; then
    jq -r '.quests[] | "| `\(.id)` | \(.name) | \(.type // "-") | \(.reward_gold // 0) |"' "$DATA_DIR/quests/quests.json"
fi
echo ""

echo "---"
echo ""
echo "## Summary"
echo ""
echo "| Category | Count |"
echo "|---|---|"
enemies=$(jq '.enemies | length' "$DATA_DIR/enemies/enemies.json" 2>/dev/null || echo 0)
items=$(jq '.items | length' "$DATA_DIR/items/items.json" 2>/dev/null || echo 0)
skills=$(jq '.skills | length' "$DATA_DIR/skills/skills.json" 2>/dev/null || echo 0)
equipment=$(jq '.equipment | length' "$DATA_DIR/equipment/equipment.json" 2>/dev/null || echo 0)
party=$(jq '.members | length' "$DATA_DIR/party/party.json" 2>/dev/null || echo 0)
quests=$(jq '.quests | length' "$DATA_DIR/quests/quests.json" 2>/dev/null || echo 0)
echo "| Enemies | $enemies |"
echo "| Items | $items |"
echo "| Skills | $skills |"
echo "| Equipment | $equipment |"
echo "| Party Members | $party |"
echo "| Quests | $quests |"
