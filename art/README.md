# Art pipeline (source assets)

This folder is the source-of-truth for deterministic art generation.

## Folder meanings
- `templates/`: pixel kit settings (grid, resolution, palette) and Godot templates
- `recipes/`: per-asset "build scripts" (yaml/json/markdown) describing how to reproduce outputs
- `palettes/`: per-biome + global palettes
- `source/`: raw inputs (AI generations, kitbash, references)
- `exports/`: deterministic outputs (sprites, scenes, battle backgrounds)

## Rule
Do not hand-edit files in `game/assets/` that came from baking. Fix the source/template/recipe instead.
