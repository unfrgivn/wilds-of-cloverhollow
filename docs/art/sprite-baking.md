# Sprite baking (3D → 8-direction sprites)

## Why
We cannot rely on hand-drawing and we need deterministic consistency.

## Output sets
- Overworld: 8-direction (N, NE, E, SE, S, SW, W, NW)
- Battle: 2-direction (L/R) side-view

## Naming convention
- Overworld frames: `{id}_idle_<DIR>.png` and `{id}_walk_<DIR>.png`
- `DIR` is `N, NE, E, SE, S, SW, W, NW`
- Runtime animation names: `idle_<dir>`, `walk_<dir>` (lowercase)
- Battle idle frames: `{id}_battle_idle_L.png` and `{id}_battle_idle_R.png`
- Character recipes set `"category": "character"` (runtime outputs under `game/assets/sprites/characters/<id>`)

## Process (baseline)
1) Create/update a character in Blender using the rig template
2) Bake PNG sequences for each direction and animation clip
3) Quantize to palette and validate frame counts
4) Pack and import into Godot `SpriteFrames`
