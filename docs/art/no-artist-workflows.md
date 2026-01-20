# No-artist workflows (generate assets deterministically)

This document is written for a developer who does **not** do manual 2D/3D art.

Principle: AI can generate inputs, but **templates + scripts** are what make the output consistent.

This doc defines “one-command” recipes for:
- 3D props (low-poly toon)
- character sprites (3D → 8-direction overworld + L/R battle)
- pre-rendered battle backgrounds

---

## 0) Folder meanings (don’t skip)

- `art/source/` — raw inputs and references (AI outputs, kitbash, scans, notes)
- `art/templates/` — versioned Blender/Godot templates that lock camera, lighting, and materials
- `art/recipes/` — per-asset YAML/JSON files that describe how to reproduce outputs
- `art/exports/` — deterministic outputs (sprites, models, backgrounds) that get imported into Godot

Rule: if something looks wrong in-game, fix the **template or recipe**, not the imported asset.

---

## 1) Create a new prop (low-poly toon)

### Inputs
- A JSON recipe defining composite parts (box, cylinder, sphere) and palette colors.

### Steps
1. Create a recipe:
   - `art/recipes/props/<biome>/<prop_id>.json`
   - Example:
     ```json
     {
       "id": "crate",
       "parts": [
         { "type": "box", "size": [1, 1, 1], "color": "wood_base" }
       ]
     }
     ```
2. Run bake script (Godot headless):
   - `python3 tools/python/bake_props.py --recipe art/recipes/props/<biome>/<prop_id>.json`
   - Or bake all: `python3 tools/python/bake_props.py --all`
   - Set `GODOT_BIN` if the Godot binary is not on PATH.
3. Confirm output:
   - `art/exports/models/props/<prop_id>/<prop_id>.tscn`
   - `game/assets/props/<prop_id>.tscn`

### Quality gates (what “good” means)
- Correct scale in meters (1 unit = 1 meter)
- Uses only approved palette colors
- Deterministic generation (same recipe = same output)

---

## 2) Create a building facade (low-poly toon)

### Inputs
- A JSON recipe defining composite parts (box, cylinder, sphere) and palette colors.

### Steps
1. Create a recipe:
   - `art/recipes/buildings/<biome>/<building_id>.json`
   - Example:
     ```json
     {
       "id": "facade_school",
       "parts": [
         { "type": "box", "size": [14, 6, 6], "color": "stone_base" }
       ]
     }
     ```
2. Run bake script (Godot headless):
   - `python3 tools/python/bake_buildings.py --recipe art/recipes/buildings/<biome>/<building_id>.json`
   - Or bake all: `python3 tools/python/bake_buildings.py --all`
   - Set `GODOT_BIN` if the Godot binary is not on PATH.
3. Confirm output:
   - `art/exports/models/buildings/<building_id>/<building_id>.tscn`
   - `game/assets/buildings/<building_id>.tscn`

### Quality gates (what “good” means)
- Correct scale in meters (1 unit = 1 meter)
- Uses only approved palette colors
- Deterministic generation (same recipe = same output)

---

## 3) Create a new character/NPC (sprite bake)

### Inputs
- A JSON recipe defining the character structure (composite parts).

### Steps
1. Create recipe:
   - `art/recipes/characters/<char_id>.json`
   - Example:
     ```json
     {
       "id": "fae",
       "type": "character",
       "category": "character",
       "parts": [...]
     }
     ```
   - `category` can be "character" (for party/NPCs) or "enemy" (default).
2. Run sprite bake (Godot headless):
   - `python3 tools/python/bake_sprites.py --recipe art/recipes/characters/<char_id>.json`
   - Set `GODOT_BIN` if the Godot binary is not on PATH.
3. Run validator:
   - `python3 tools/python/validate_assets.py --character <char_id>`

### Output expectations
- Overworld: 8 directions (N, NE, E, SE, S, SW, W, NW)
- Battle: 2 directions (L/R) (outputs `*_battle_idle_L.png` and `*_battle_idle_R.png`)
- Transparent background for all frames
- Outputs to `art/exports/sprites/<char_id>/`
- Runtime copies go to:
  - `game/assets/sprites/characters/<char_id>/` (if category="character")
  - `game/assets/sprites/enemies/<char_id>/` (if category="enemy")

---

## 4) Create a battle background (pre-render)

### Steps
1. Create recipe:
   - `art/recipes/battle_backgrounds/<biome>/<bg_id>.json`
   - Example:
     ```json
     {
       "id": "town_square",
       "type": "battle_background",
       "biome": "cloverhollow",
       "colors": { "sky": "sky_day", "ground": "grass_base" }
     }
     ```
2. Run bake script (Godot headless):
   - `python3 tools/python/bake_battle_backgrounds.py --recipe art/recipes/battle_backgrounds/<biome>/<bg_id>.json`
   - Or bake all: `python3 tools/python/bake_battle_backgrounds.py --all`
3. Copy/verify the final output lands in:
   - `game/assets/battle_backgrounds/<biome>/<bg_id>/bg.png`

### Quality gates
- No banding artifacts that violate the 4-band toon shading intent
- Foreground is optional, but if used it must be alpha-clean

---

## 5) The single most important rule

If you cannot reproduce an asset from:
- the recipe,
- the template,
- and the scripts,

then it is not production-ready and cannot be relied on as the world expands.
