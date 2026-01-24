# Sprite baking (Pixel Art Design Kit)

## Why
We use a deterministic "Pixel Art Design Kit" pipeline.
Characters are defined in JSON recipes (`art/recipes/characters/`) and rendered at low resolution (e.g., 48x48) from simple shape parts to achieve a consistent pixel art look.

## Output sets
- Overworld: 8-direction (N, NE, E, SE, S, SW, W, NW)
- Battle: 2-direction (L/R) side-view

## Naming convention
- Overworld frames: `{id}_idle_<DIR>.png` and `{id}_walk_<DIR>.png`
- `DIR` is `N, NE, E, SE, S, SW, W, NW`
- Runtime animation names: `idle_<dir>`, `walk_<dir>` (lowercase)
- Battle idle frames: `{id}_battle_idle_L.png` and `{id}_battle_idle_R.png`
- Character recipes set "category": "character" (runtime outputs under `game/assets/sprites/characters/<id>`)

## Recipe format
Recipes are JSON files in `art/recipes/characters/`.

```json
{
  "id": "fae",
  "type": "character",
  "category": "character",
  "render": {
    "resolution": 48,
    "pixels_per_meter": 24
  },
  "palette": "res://art/palettes/common.palette.json",
  "parts": [
    { "type": "sphere", "radius": 0.5, "pos": [0, 0.45, 0], "color": "hero_blue" },
    { "type": "box", "size": [1, 1, 1], "pos": [0, 1, 0], "color": "white" }
  ]
}
```

### Render settings
- `resolution`: Output sprite size in pixels (default: 48).
- `pixels_per_meter`: World-to-pixel scale (default: 24).

### Parts
- `type`: "sphere" or "box".
- `pos`: [x, y, z] position.
- `rot`: [x, y, z] rotation in degrees.
- `scale`: [x, y, z] scale.
- `color`: Name of the color defined in `art/palettes/*.palette.json`.

## Process
1. Define character in `art/recipes/characters/<id>.json`.
2. Run baking script:
   ```bash
   python tools/python/bake_sprites.py --recipe art/recipes/characters/<id>.json
   ```
3. Output PNGs are generated in `art/exports/sprites/<id>/`.
4. Godot imports these as `SpriteFrames` (ensure Texture Filter is set to "Nearest" in Godot).

