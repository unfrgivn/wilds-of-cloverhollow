# Wilds of Cloverhollow - Justfile
# Run `just --list` to see all available recipes

# Default recipe
default: list

# List available recipes
list:
    @just --list

# ==================== CI ====================

smoke:
    ./tools/ci/run-smoke.sh

tests:
    ./tools/ci/run-tests.sh

spec-check:
    ./tools/ci/run-spec-check.sh

scenario name:
    ./tools/ci/run-scenario.sh {{name}}

scenario-rendered name:
    ./tools/ci/run-scenario-rendered.sh {{name}}

ci: smoke tests spec-check

# ==================== Assets ====================

assets: validate-assets quantize-assets
    @echo "Asset pipeline complete"

validate-assets:
    #!/usr/bin/env bash
    set -euo pipefail
    ERRORS=0
    
    echo "[assets] Validating sprites..."
    
    for palette in art/palettes/*.palette.json; do
        [ -f "$palette" ] || continue
        biome=$(basename "$palette" .palette.json)
        
        sprite_dir="game/assets/sprites"
        if [ -d "$sprite_dir" ]; then
            while IFS= read -r -d '' sprite; do
                if ! ./tools/art/validate_sprite.sh "$sprite" --palette "$palette" --grid 16 2>/dev/null; then
                    echo "[assets] WARN: $sprite may have issues with $biome palette"
                fi
            done < <(find "$sprite_dir" -name "*.png" -print0 2>/dev/null || true)
        fi
    done
    
    echo "[assets] Validating battle backgrounds..."
    bg_dir="game/assets/sprites/backgrounds"
    if [ -d "$bg_dir" ]; then
        while IFS= read -r -d '' bg; do
            width=$(magick identify -format "%w" "$bg" 2>/dev/null || identify -format "%w" "$bg" 2>/dev/null || echo "0")
            height=$(magick identify -format "%h" "$bg" 2>/dev/null || identify -format "%h" "$bg" 2>/dev/null || echo "0")
            if [ "$width" != "512" ] || [ "$height" != "288" ]; then
                echo "[assets] ERROR: Background $bg is ${width}x${height}, expected 512x288"
                ERRORS=$((ERRORS + 1))
            fi
        done < <(find "$bg_dir" -name "*.png" -print0 2>/dev/null || true)
    fi
    
    if [ $ERRORS -gt 0 ]; then
        echo "[assets] $ERRORS error(s) found"
        exit 1
    fi
    echo "[assets] Validation passed"

quantize-assets:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "[assets] Quantizing sprites to palettes..."
    
    global_palette="art/palettes/global.palette.json"
    if [ ! -f "$global_palette" ]; then
        echo "[assets] SKIP: No global palette found"
        exit 0
    fi
    
    sprite_dirs=(
        "game/assets/sprites/characters"
        "game/assets/sprites/props"
        "game/assets/sprites/tiles"
    )
    
    for dir in "${sprite_dirs[@]}"; do
        if [ -d "$dir" ]; then
            while IFS= read -r -d '' sprite; do
                echo "  Quantizing: $sprite"
                ./tools/art/quantize_to_palette.sh "$sprite" "$global_palette" 2>/dev/null || true
            done < <(find "$dir" -name "*.png" -print0 2>/dev/null || true)
        fi
    done
    
    echo "[assets] Quantization complete"

pack-spritesheets:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "[assets] Packing spritesheets..."
    
    spritesheet_manifest="art/spritesheets.txt"
    if [ ! -f "$spritesheet_manifest" ]; then
        echo "[assets] SKIP: No spritesheet manifest found at $spritesheet_manifest"
        exit 0
    fi
    
    while IFS= read -r line || [ -n "$line" ]; do
        [ -z "$line" ] && continue
        [[ "$line" == \#* ]] && continue
        
        input_dir=$(echo "$line" | cut -d' ' -f1)
        output_file=$(echo "$line" | cut -d' ' -f2)
        cols=$(echo "$line" | cut -d' ' -f3)
        
        if [ -d "$input_dir" ]; then
            echo "  Packing: $input_dir -> $output_file (cols: ${cols:-auto})"
            if [ -n "$cols" ]; then
                ./tools/art/pack_spritesheet.sh "$input_dir" "$output_file" --cols "$cols"
            else
                ./tools/art/pack_spritesheet.sh "$input_dir" "$output_file"
            fi
        fi
    done < "$spritesheet_manifest"
    
    echo "[assets] Spritesheet packing complete"

import-godot:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "[assets] Running Godot import..."
    : "${GODOT_BIN:=godot}"
    timeout 60 $GODOT_BIN --headless --import 2>&1 || true
    echo "[assets] Godot import complete"

# Full asset pipeline: validate, quantize, pack, import
assets-full: validate-assets quantize-assets pack-spritesheets import-godot
    @echo "Full asset pipeline complete"

# ==================== Content ====================

lint-content:
    ./tools/lint/lint-content.sh

new-biome id name="" type="exploration":
    ./tools/content/new-biome.sh {{id}} {{name}} {{type}}

check-biome id:
    ./tools/content/check-biome.sh {{id}}

# ==================== Visual Regression ====================

visual-regression:
    ./tools/ci/run-visual-regression.sh

compare-captures:
    ./tools/ci/compare-captures.sh

# ==================== Development ====================

run:
    : "${GODOT_BIN:=godot}" && $GODOT_BIN --path .

editor:
    : "${GODOT_BIN:=godot}" && $GODOT_BIN --path . --editor

# Run specific scene
run-scene scene:
    : "${GODOT_BIN:=godot}" && $GODOT_BIN --path . {{scene}}
