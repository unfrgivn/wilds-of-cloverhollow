# Battle backgrounds (pre-rendered)

## Goals
- High visual quality with low runtime cost on iOS
- Cohesive look with exploration environments

## Outputs
- `game/assets/battle_backgrounds/<biome>/<id>/bg.png`
- optional `fg.png` overlay for depth

## Recommended resolutions (initial)
These are defaults; adjust if performance or memory requires.

- **Source render (authoring):** 3840×2160 (4K)
  - Rationale: iPad-class devices will downscale, not upscale.
- **In-game usage:** downscale to fit the current viewport.

Rule: never ship a background that was upscaled from a smaller source.

## Source
- Blender diorama scenes or Godot stage scenes (choose one and standardize)

Initial standard: use Blender dioramas for deterministic output controlled by templates.
