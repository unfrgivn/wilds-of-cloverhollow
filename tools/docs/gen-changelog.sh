#!/bin/bash
# Generate changelog from git commits
# Groups commits by milestone and category

set -e

echo "# Changelog"
echo ""
echo "Auto-generated from git commits."
echo ""
echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "---"
echo ""

# Get all milestone commits in reverse chronological order
git log --oneline --grep="Milestone" --format="%H|%s|%as" | while IFS='|' read -r hash subject date; do
    # Extract milestone number from subject
    milestone=$(echo "$subject" | grep -oE 'Milestone [0-9]+' | head -1)
    if [[ -n "$milestone" ]]; then
        # Extract the feat/fix/etc type and description
        type=$(echo "$subject" | grep -oE '^[a-z]+:' | tr -d ':')
        desc=$(echo "$subject" | sed 's/^[a-z]*: //' | sed 's/ (Milestone [0-9]*)$//')
        
        echo "## $milestone"
        echo ""
        echo "**Date:** $date"
        echo ""
        echo "- $desc"
        echo ""
    fi
done

# Recent non-milestone commits
echo "## Recent Changes (Non-milestone)"
echo ""
git log --oneline --format="- %s (%as)" -20 | grep -v "Milestone" | head -10 || echo "- No non-milestone changes"
echo ""
echo "---"
echo ""
echo "*See [plan.md](working-sessions/plan.md) for milestone details.*"
