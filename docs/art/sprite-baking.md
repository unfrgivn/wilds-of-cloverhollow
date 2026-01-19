# Sprite baking (3D → 8-direction sprites)

## Why
We cannot rely on hand-drawing and we need deterministic consistency.

## Output sets
- Overworld: 8-direction (N, NE, E, SE, S, SW, W, NW)
- Battle: 2-direction (L/R) side-view

## Process (baseline)
1) Create/update a character in Blender using the rig template
2) Bake PNG sequences for each direction and animation clip
3) Quantize to palette and validate frame counts
4) Pack and import into Godot `SpriteFrames`
