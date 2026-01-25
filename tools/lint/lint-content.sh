#!/usr/bin/env bash
# lint-content.sh - Validate game data JSON files
# Checks: valid JSON, required fields, reference integrity

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/game/data"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

log_error() {
    echo -e "${RED}ERROR:${NC} $1"
    ((ERRORS++)) || true
}

log_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
    ((WARNINGS++)) || true
}

log_ok() {
    echo -e "${GREEN}OK:${NC} $1"
}

# Check if jq is available
if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Install with: brew install jq"
    exit 1
fi

echo "=== Content Lint ==="
echo "Data directory: $DATA_DIR"
echo ""

# Validate JSON syntax for all files
echo "--- JSON Syntax Check ---"
for json_file in $(find "$DATA_DIR" -name "*.json" 2>/dev/null); do
    rel_path="${json_file#$PROJECT_ROOT/}"
    if jq empty "$json_file" 2>/dev/null; then
        log_ok "$rel_path"
    else
        log_error "$rel_path - Invalid JSON syntax"
    fi
done
echo ""

# Validate enemies.json schema
ENEMIES_FILE="$DATA_DIR/enemies/enemies.json"
if [[ -f "$ENEMIES_FILE" ]]; then
    echo "--- Enemies Schema Check ---"
    enemy_count=$(jq '.enemies | length' "$ENEMIES_FILE" 2>/dev/null || echo "0")
    echo "Found $enemy_count enemies"
    
    # Check required fields for each enemy
    for i in $(seq 0 $((enemy_count - 1))); do
        enemy_id=$(jq -r ".enemies[$i].id // \"\"" "$ENEMIES_FILE")
        if [[ -z "$enemy_id" ]]; then
            log_error "Enemy at index $i missing 'id' field"
        else
            for field in name max_hp attack defense speed; do
                val=$(jq -r ".enemies[$i].$field // \"\"" "$ENEMIES_FILE")
                if [[ -z "$val" ]]; then
                    log_error "Enemy '$enemy_id' missing required field: $field"
                fi
            done
        fi
    done
    echo ""
fi

# Validate skills.json schema
SKILLS_FILE="$DATA_DIR/skills/skills.json"
if [[ -f "$SKILLS_FILE" ]]; then
    echo "--- Skills Schema Check ---"
    skill_count=$(jq '.skills | length' "$SKILLS_FILE" 2>/dev/null || echo "0")
    echo "Found $skill_count skills"
    
    for i in $(seq 0 $((skill_count - 1))); do
        skill_id=$(jq -r ".skills[$i].id // \"\"" "$SKILLS_FILE")
        if [[ -z "$skill_id" ]]; then
            log_error "Skill at index $i missing 'id' field"
        else
            for field in name type mp_cost; do
                val=$(jq -r ".skills[$i].$field // \"\"" "$SKILLS_FILE")
                if [[ -z "$val" ]]; then
                    log_error "Skill '$skill_id' missing required field: $field"
                fi
            done
        fi
    done
    echo ""
fi

# Validate items.json schema
ITEMS_FILE="$DATA_DIR/items/items.json"
if [[ -f "$ITEMS_FILE" ]]; then
    echo "--- Items Schema Check ---"
    item_count=$(jq '.items | length' "$ITEMS_FILE" 2>/dev/null || echo "0")
    echo "Found $item_count items"
    
    for i in $(seq 0 $((item_count - 1))); do
        item_id=$(jq -r ".items[$i].id // \"\"" "$ITEMS_FILE")
        if [[ -z "$item_id" ]]; then
            log_error "Item at index $i missing 'id' field"
        else
            for field in name type effect; do
                val=$(jq -r ".items[$i].$field // \"\"" "$ITEMS_FILE")
                if [[ -z "$val" ]]; then
                    log_error "Item '$item_id' missing required field: $field"
                fi
            done
        fi
    done
    echo ""
fi

# Validate party.json schema
PARTY_FILE="$DATA_DIR/party/party.json"
if [[ -f "$PARTY_FILE" ]]; then
    echo "--- Party Schema Check ---"
    member_count=$(jq '.members | length' "$PARTY_FILE" 2>/dev/null || echo "0")
    echo "Found $member_count party members"
    
    for i in $(seq 0 $((member_count - 1))); do
        member_id=$(jq -r ".members[$i].id // \"\"" "$PARTY_FILE")
        if [[ -z "$member_id" ]]; then
            log_error "Party member at index $i missing 'id' field"
        else
            for field in name max_hp max_mp attack defense speed; do
                val=$(jq -r ".members[$i].$field // \"\"" "$PARTY_FILE")
                if [[ -z "$val" ]]; then
                    log_error "Party member '$member_id' missing required field: $field"
                fi
            done
        fi
    done
    echo ""
fi

# Check skill references in enemies
echo "--- Reference Integrity Check ---"
if [[ -f "$ENEMIES_FILE" ]] && [[ -f "$SKILLS_FILE" ]]; then
    valid_skills=$(jq -r '.skills[].id' "$SKILLS_FILE" 2>/dev/null | tr '\n' ' ')
    enemy_count=$(jq '.enemies | length' "$ENEMIES_FILE" 2>/dev/null || echo "0")
    
    for i in $(seq 0 $((enemy_count - 1))); do
        enemy_id=$(jq -r ".enemies[$i].id" "$ENEMIES_FILE")
        skill_refs=$(jq -r ".enemies[$i].skills[]?" "$ENEMIES_FILE" 2>/dev/null || true)
        for skill_ref in $skill_refs; do
            if [[ ! " $valid_skills " =~ " $skill_ref " ]]; then
                log_warning "Enemy '$enemy_id' references undefined skill: $skill_ref"
            fi
        done
    done
fi

# Check skill references in party members
if [[ -f "$PARTY_FILE" ]] && [[ -f "$SKILLS_FILE" ]]; then
    valid_skills=$(jq -r '.skills[].id' "$SKILLS_FILE" 2>/dev/null | tr '\n' ' ')
    member_count=$(jq '.members | length' "$PARTY_FILE" 2>/dev/null || echo "0")
    
    for i in $(seq 0 $((member_count - 1))); do
        member_id=$(jq -r ".members[$i].id" "$PARTY_FILE")
        skill_refs=$(jq -r ".members[$i].skills[]?" "$PARTY_FILE" 2>/dev/null || true)
        for skill_ref in $skill_refs; do
            if [[ ! " $valid_skills " =~ " $skill_ref " ]]; then
                log_warning "Party member '$member_id' references undefined skill: $skill_ref"
            fi
        done
    done
fi
echo ""

# Summary
echo "=== Summary ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"

if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}Content lint FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Content lint PASSED${NC}"
    exit 0
fi
