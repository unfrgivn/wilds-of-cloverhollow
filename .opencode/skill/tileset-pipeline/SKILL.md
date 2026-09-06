---
name: tileset-pipeline
description: Build or review Cloverhollow 16x16 biome tilesets and atlases. Use for tile art, props, palette compliance, packing, or grid-alignment work.
compatibility: Godot 4.5.1, ImageMagick, jq, Python 3
---

# Tileset pipeline

Read `docs/art/style-lock.md`, `docs/art/palettes.md`, and the relevant biome
docs before changing art. Keep the 16x16 tile grid, nearest-neighbor pixels,
clean silhouettes, and the eight-direction naming convention in mind. Props may
be larger than one tile when the asset spec requires it.

## Workflow

1. Inspect existing assets and palette JSON before generating anything.
2. Use the actual project output path and preserve source files. Do not
   overwrite an input during quantization.
3. Treat `tools/art/quantize_to_palette.py` and `tools/art/validate_sprite.py`
   as placeholders until implemented. The shell helpers currently assume a
   flat `.colors[]` palette and are not reliable with nested palette objects.
4. Validate dimensions, transparency, palette membership, grid alignment, and
   readability manually from the generated artifact. Never “pass” a broken
   validator or claim a stub ran a real check.
5. For visual changes, run a real rendered Scenario Runner scenario, inspect
   `trace.json`, the run log, and every capture with image reading/vision.

Fail closed on missing palettes, unknown asset dimensions, tool errors, or
missing captures. Do not use blanket color quantization to hide a palette
problem.
