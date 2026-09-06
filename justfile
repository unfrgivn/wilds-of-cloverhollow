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

assets: validate-assets art-tests

art-tests:
    uv run --locked --project . python tests/art/test_art_pipeline.py

validate-assets:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "[assets] Validating selected manifest samples (not the full game asset tree)..."
    ./tools/art/validate_sprite.sh game/assets/sprites/props/bench.png --palette art/palettes/cloverhollow.palette.json --palette art/palettes/global_ui_skin.palette.json --size 16x16
    ./tools/art/validate_sprite.sh game/assets/sprites/props/polished/bench.png --palette art/palettes/cloverhollow.palette.json --palette art/palettes/global_ui_skin.palette.json --size 16x16
    echo "[assets] Validation passed"

quantize-assets:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "[assets] Quantization is opt-in: pass input, palette, and separate output to the CLI"
    echo "[assets] No blanket in-place quantization performed"

pack-spritesheets:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "[assets] Packing spritesheets..."
    
    spritesheet_manifest="art/spritesheets.txt"
    if [ ! -f "$spritesheet_manifest" ]; then
        echo "[assets] ERROR: No spritesheet manifest found at $spritesheet_manifest" >&2
        exit 1
    fi
    
    while IFS= read -r line || [ -n "$line" ]; do
        [ -z "$line" ] && continue
        [[ "$line" == \#* ]] && continue
        
        input_dir=$(echo "$line" | cut -d' ' -f1)
        output_file=$(echo "$line" | cut -d' ' -f2)
        cols=$(echo "$line" | cut -d' ' -f3)
        
        if [ ! -d "$input_dir" ]; then
            echo "[assets] ERROR: Manifest input directory not found: $input_dir" >&2
            exit 1
        fi
        echo "  Packing: $input_dir -> $output_file (cols: ${cols:-auto})"
        if [ -n "$cols" ]; then
            ./tools/art/pack_spritesheet.sh "$input_dir" "$output_file" --cols "$cols"
        else
            ./tools/art/pack_spritesheet.sh "$input_dir" "$output_file"
        fi
    done < "$spritesheet_manifest"
    
    echo "[assets] Spritesheet packing complete"

import-godot:
    #!/usr/bin/env bash
    set -euo pipefail
    : "${GODOT_BIN:=godot}"
    if ! command -v "$GODOT_BIN" >/dev/null 2>&1; then
        echo "[assets] ERROR: GODOT_BIN '$GODOT_BIN' is unavailable" >&2
        exit 1
    fi
    echo "[assets] Running Godot import..."
    "$GODOT_BIN" --headless --path . --import
    echo "[assets] Godot import complete"

# Full asset pipeline: validate, quantize, pack, import
assets-full: validate-assets art-tests pack-spritesheets import-godot

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
