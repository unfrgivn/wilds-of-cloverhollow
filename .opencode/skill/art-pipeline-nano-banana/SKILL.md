---
name: art-pipeline-nano-banana
description: Nano banana prompt and import pipeline for EarthBound-like pixel art
compatibility: opencode
---
# Skill: Art Pipeline Integration (nano banana outputs → Godot-ready assets)

## Objective
Turn externally generated images (nano banana via the user’s image tool) into game-ready assets with consistent scale, naming, and import settings.

## Steps

1) Create art folders (if not already present)
- `art/prompts/`
- `art/source/`
- `art/exports/`

2) Add prompt templates
- Create markdown or yaml templates per asset type:
  - `fae_sprite_sheet.md`
  - `npc_sprite_sheet.md`
  - `room_backdrop_arcade.md`
  - `room_backdrop_school.md`
  - `props_icons.md`

3) Define hard constraints in every prompt
- transparent background for sprites/props
- consistent canvas size (so slicing is deterministic)
- consistent baseline alignment for walk cycles
- no embedded text (except simple signage shapes)

4) Export processing (manual or scripted)
- Crop excess whitespace.
- Ensure background transparency is correct.
- Normalize scale relative to your chosen character height.
- Save to `art/exports/` using stable filenames:
  - `fae_walksheet_v01.png`
  - `arcade_backdrop_v01.png`
  - `prop_blacklight_lantern_v01.png`

5) Godot import rules
Decide whether the project uses:
- direct rendering (filtered textures OK), or
- low-res SubViewport retro filter (recommended for cohesive look)

For each imported texture:
- disable mipmaps unless you explicitly need them
- ensure alpha is preserved

6) Create resources for in-game use
- For sprite sheets:
  - build `SpriteFrames` resources for `AnimatedSprite2D`
  - name animations consistently: `walk_down`, `walk_up`, `walk_left`, `walk_right`, `idle_*`
- For item icons:
  - reference the PNG in `ItemData.tres` resources

## Acceptance checks
- Fae sprite frames align (no “teleporting” pivot between frames).
- Props read at inventory icon size.
- Rooms have enough empty floor space for navigation.
- Everything looks acceptable when rendered at the internal game resolution.
