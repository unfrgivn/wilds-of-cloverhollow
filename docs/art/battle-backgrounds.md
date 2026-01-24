# Battle backgrounds (pixel art)

## Goals
- High readability with low runtime cost on iOS
- Cohesive look with exploration environments

## Outputs
- `game/assets/battle_backgrounds/<biome>/<id>/bg.png`
- optional `fg.png` overlay for depth

## Recommended resolutions (initial)
These are defaults; adjust if performance or memory requires.

- **Source render (authoring):** 960×540 (2× of 480×270)
- **In-game usage:** nearest-neighbor scale to 1920×1080 (integer scale only)

Rule: never ship a background that was upscaled from a smaller source by non-integer scaling.

## Source
- Godot pixel stage scenes or deterministic recipe renders (choose one and standardize)

Initial standard: use Godot headless recipes for deterministic output controlled by templates.

## Stub generation (development)
- Placeholder background uses `tools/art/generate_battle_background_stub.gd`.
- Recipe: `art/recipes/battle_backgrounds/cloverhollow_meadow_stub.md`.
- Run: `godot --headless --script tools/art/generate_battle_background_stub.gd`.
