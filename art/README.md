# Art pipeline (source assets)

This folder is the source-of-truth for deterministic art generation.

## Folder meanings
- `templates/`: Blender and Godot templates that lock camera/lighting/materials
- `recipes/`: per-asset "build scripts" (yaml/json/markdown) describing how to reproduce outputs
- `palettes/`: per-biome + global palettes
- `ramps/`: toon ramps (4-band)
- `source/`: raw inputs (AI generations, kitbash, references)
- `exports/`: deterministic outputs (sprites, models, battle backgrounds)

## Rule
Do not hand-edit files in `game/assets/` that came from baking. Fix the source/template/recipe instead.
