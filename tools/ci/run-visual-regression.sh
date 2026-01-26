#!/usr/bin/env bash
# Run visual regression scenarios and capture frames
set -euo pipefail

: "${GODOT_BIN:=godot}"
: "${CAPTURE_DIR:=captures/current}"
: "${SEED:=12345}"
: "${QUIT_AFTER_FRAMES:=120}"

# List of rendered scenarios to run for visual regression
RENDERED_SCENARIOS=(
    "town_center_render"
    "hero_house_render"
    "battle_scene_render"
)

mkdir -p "$CAPTURE_DIR"

echo "[visual-regression] Running ${#RENDERED_SCENARIOS[@]} rendered scenarios"

FAILED=0
for scenario in "${RENDERED_SCENARIOS[@]}"; do
    SCENARIO_CAPTURE_DIR="$CAPTURE_DIR/$scenario"
    mkdir -p "$SCENARIO_CAPTURE_DIR"
    
    echo "[visual-regression] Running: $scenario"
    
    # Run with xvfb-run for headless display on Linux
    if command -v xvfb-run &> /dev/null; then
        xvfb-run -a "$GODOT_BIN" --path . -- \
            --scenario "$scenario" \
            --seed "$SEED" \
            --capture_dir "$SCENARIO_CAPTURE_DIR" \
            --quit_after_frames "$QUIT_AFTER_FRAMES" || {
            echo "[visual-regression] FAILED: $scenario"
            FAILED=$((FAILED + 1))
            continue
        }
    else
        # macOS or systems with display
        "$GODOT_BIN" --path . -- \
            --scenario "$scenario" \
            --seed "$SEED" \
            --capture_dir "$SCENARIO_CAPTURE_DIR" \
            --quit_after_frames "$QUIT_AFTER_FRAMES" || {
            echo "[visual-regression] FAILED: $scenario"
            FAILED=$((FAILED + 1))
            continue
        }
    fi
    
    echo "[visual-regression] OK: $scenario"
done

if [ $FAILED -gt 0 ]; then
    echo "[visual-regression] $FAILED scenario(s) failed"
    exit 1
fi

echo "[visual-regression] All scenarios completed"
