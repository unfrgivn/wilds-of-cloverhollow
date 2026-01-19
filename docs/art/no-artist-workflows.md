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
- `art/templates/` — versioned Blender/Godot templates that lock camera, lighting, and shader settings
- `art/recipes/` — per-asset YAML/JSON files that describe how to reproduce outputs
- `art/exports/` — deterministic outputs (sprites, models, backgrounds) that get imported into Godot

Rule: if something looks wrong in-game, fix the **template or recipe**, not the imported asset.

---

## 1) Create a new prop (low-poly toon)

### Inputs
You need ONE of:
- an AI-generated mesh (GLB/FBX/OBJ), or
- a simple mesh you created from primitives.

### Steps
1. Put the source mesh in:
   - `art/source/blender/props/<prop_id>/source.glb`
2. Create a recipe:
   - `art/recipes/props/<prop_id>.json`
3. Run:
   - `python3 tools/python/validate_assets.py --recipe art/recipes/props/<prop_id>.json`
4. Bake/normalize (once implemented):
   - `blender -b -P tools/blender/normalize_prop_mesh.py -- --recipe art/recipes/props/<prop_id>.json`
5. Confirm output:
   - `art/exports/models/props/<prop_id>/<prop_id>.glb`

### Quality gates (what “good” means)
- Correct scale in meters (no microscopic or giant meshes)
- Uses only approved toon materials
- Has collision (or collision is intentionally omitted and documented)

---

## 2) Create a new character/NPC (sprite bake)

### What you need
- A single humanoid rig template (provided in `art/templates/blender/character_rig.blend` once created)
- Optional modular parts (hair, outfit) that the agent can swap

### Steps
1. Create recipe:
   - `art/recipes/characters/<char_id>.json`
2. Put any source meshes/textures under:
   - `art/source/blender/characters/<char_id>/...`
3. Run sprite bake:
   - `blender -b -P tools/blender/bake_character_sprites.py -- --recipe art/recipes/characters/<char_id>.json`
4. Run palette normalization (Godot headless):
   - `python3 tools/python/palette_quantize.py --in art/exports/sprites/<char_id>/... --out ... --palette art/palettes/<biome>.palette.json`
   - Set `GODOT_BIN` if the Godot binary is not on PATH.
5. Run validator:
   - `python3 tools/python/validate_assets.py --character <char_id>`

### Output expectations
- Overworld: 8 directions (N, NE, E, SE, S, SW, W, NW)
- Battle: 2 directions (L/R)
- Transparent background for all frames

---

## 3) Create a battle background (pre-render)

### Steps
1. Create recipe:
   - `art/recipes/battle_backgrounds/<biome>/<bg_id>.json`
2. Build the diorama scene (agent can do this) using biome materials.
3. Render via script:
   - `blender -b -P tools/blender/bake_battle_background.py -- --recipe art/recipes/battle_backgrounds/<biome>/<bg_id>.json`
4. Palette normalize if needed.
5. Copy/verify the final output lands in:
   - `game/assets/battle_backgrounds/<biome>/<bg_id>/bg.png`

### Quality gates
- No banding artifacts that violate the 4-band toon shading intent
- Foreground is optional, but if used it must be alpha-clean

---

## 4) The single most important rule

If you cannot reproduce an asset from:
- the recipe,
- the template,
- and the scripts,

then it is not production-ready and cannot be relied on as the world expands.
