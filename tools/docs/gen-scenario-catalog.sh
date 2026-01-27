#!/bin/bash
# Generate scenario catalog from JSON files
# Usage: ./tools/docs/gen-scenario-catalog.sh > docs/testing/scenario-catalog.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCENARIOS_DIR="$PROJECT_ROOT/tests/scenarios"

echo "# Scenario Catalog"
echo ""
echo "Auto-generated catalog of all test scenarios."
echo ""
echo "**Total scenarios:** $(ls -1 "$SCENARIOS_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')"
echo ""
echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "---"
echo ""
echo "## Scenarios"
echo ""
echo "| ID | Name | Description | Scene |"
echo "|---|---|---|---|"

for f in "$SCENARIOS_DIR"/*.json; do
    if [[ -f "$f" ]]; then
        id=$(jq -r '.id // "(unknown)"' "$f")
        name=$(jq -r '.name // "(no name)"' "$f")
        desc=$(jq -r '.description // "(no description)"' "$f" | head -c 80)
        scene=$(jq -r '.scene // "-"' "$f" | sed 's|res://game/scenes/areas/||' | sed 's|\.tscn||')
        echo "| \`$id\` | $name | $desc | $scene |"
    fi
done

echo ""
echo "---"
echo ""
echo "## Running Scenarios"
echo ""
echo "\`\`\`bash"
echo "# Run a specific scenario"
echo "./tools/ci/run-scenario.sh <scenario_id>"
echo ""
echo "# Run with rendering (for visual tests)"
echo "./tools/ci/run-scenario-rendered.sh <scenario_id>"
echo ""
echo "# Example"
echo "./tools/ci/run-scenario.sh battle_one_turn"
echo "\`\`\`"
echo ""
echo "## Scenario Categories"
echo ""
echo "### Smoke Tests"
echo "Quick validation scenarios with \`_smoke\` suffix."
echo ""
echo "### Render Tests"  
echo "Visual verification scenarios with \`_render\` suffix."
echo ""
echo "### Walkthrough Tests"
echo "Full interaction flows with \`_walkthrough\` suffix."
echo ""
echo "### Stub Tests"
echo "Placeholder scenarios with \`_stub\` suffix for future content."
