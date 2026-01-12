# UX Design Plan — Cloverhollow Prototype (Godot 4.5)

This plan defines a high‑detail, step‑by‑step UX and art pipeline for a playable demo. It aligns to the layout‑authoritative pipeline:
`layout.tscn` → `scene.json` → bake → runtime. Re‑run the pipeline after every layout or art change.

## Project Constraints (Non‑Negotiable)
- Resolution: 1280×720 (16:9)
- Coordinates: 1 unit = 1 pixel, (0,0) is top‑left
- Pipeline: `layout.tscn` → `scene.json` → `bake_walkmasks.gd` → `bake_navpolys.gd`
- Blocking: walkmask only (no tilemaps, no manual collision polygons)
- Runtime: ignores `layout.tscn`, uses `scene.json` + baked assets only
- Props: prefab‑based, collisions from footprints only

## File & Command Index (Quick Reference)
Core pipeline commands:
```bash
godot --headless --quit --script res://tools/export_layouts.gd
godot --headless --quit --script res://tools/qa_props.gd
godot --headless --quit --script res://tools/bake_walkmasks.gd
godot --headless --quit --script res://tools/bake_navpolys.gd
godot --headless --quit --script res://tools/validate_scenes.gd
godot --headless --quit --script res://tools/build_content.gd
```

Debug keys:
- `F2`: toggle exit markers
- `F3`: toggle overhangs
- `F4`: toggle decals

---

## Phase 0 — Reference Lock + Import Defaults
**Goal**: Lock reference targets, scale conventions, and import settings.

0.1 Reference targets
- [ ] Confirm art style reference: `references/legacy_art/reference/concepts/`
- [ ] Confirm demo scenes: `town_square_01`, `fae_house_01`, `school_hall_01`, `arcade_01`
- [ ] Confirm prop set: `tree_01`, `bench_01`, `crate_01`, `lamp_01`, `fence_01`

0.2 Import defaults
- [ ] Keep texture filtering `Linear`
- [ ] Keep mipmaps disabled
- [ ] Reimport after any asset changes:
  ```bash
  godot --headless --path . --import
  ```

0.3 Naming + paths
- [ ] Backgrounds: `res://content/scenes/<scene_id>/ground.png`
- [ ] Props: `res://content/props/<prop_id>/visuals/base.png`
- [ ] Variants: `res://content/props/<prop_id>/visuals/base_variant_1.png`
- [ ] Decals: `res://content/decals/<decal_id>.png`

Acceptance
- [ ] All naming matches conventions
- [ ] No missing references in layout scenes

---

## Phase 1 — Environment Backgrounds (Ground)
**Goal**: Replace placeholder grounds with final art per scene.

1.1 Generate backdrops
- [ ] Generate 1280×720 PNGs for all scenes
- [ ] Maintain cutaway staging (floor plane, partial walls)
- [ ] Keep walk lanes readable (no heavy texture noise)
- [ ] Avoid text labels embedded in art

1.2 Import + placement
- [ ] Save as `res://content/scenes/<scene_id>/ground.png`
- [ ] Open `layout.tscn` and set `Ground` Sprite2D
- [ ] Verify `Ground.centered = false`, `Ground.position = (0,0)`

1.3 Visual QA
- [ ] Scene fits exactly 1280×720
- [ ] Walkable lanes are clearly visible
- [ ] No important art extends outside bounds

Acceptance
- [ ] Backgrounds render cleanly in‑game
- [ ] Layout coordinates align with art

---

## Phase 2 — Props (Base + Overhang + Footprints)
**Goal**: Build a reusable prop library with variants and accurate footprints.

2.1 Base + overhang art
- [ ] Create `visuals/base.png` for each prop
- [ ] Create `visuals/overhang.png` for tree/lamp (if needed)
- [ ] Ensure overhang visually overlaps player at top edge

2.2 Variants (Approach 1)
- [ ] Create `base_variant_1.png`
- [ ] If has overhang, create `overhang_variant_1.png`
- [ ] Update `PropDef` arrays:
  - `base_textures = [base.png, base_variant_1.png]`
  - `overhang_textures = [overhang.png, overhang_variant_1.png]`

2.3 Footprints
- [ ] Create `footprints/block.png`
- [ ] Alpha > 0.5 blocks movement
- [ ] Anchor is bottom‑center: `(width/2, height-1)`

2.4 Placement in layouts
- [ ] Instance prop prefabs under `Props`
- [ ] Set `variant = 1` on at least one prop per scene

2.5 QA checks
- [ ] Run Prop QA:
  ```bash
  godot --headless --quit --script res://tools/qa_props.gd
  ```
- [ ] Resolve errors (warnings acceptable if documented)

Acceptance
- [ ] Props render correctly
- [ ] Overhangs sit above player
- [ ] Footprints block as expected

---

## Phase 3 — Decals (Visual‑Only)
**Goal**: Add visual detail without affecting collisions.

3.1 Decal art
- [ ] Create `scuff_01.png`, `leaf_01.png`, `sparkle_01.png`
- [ ] Keep simple, readable shapes at 16×16

3.2 Placement in layouts
- [ ] Add `DecalMarker2D` under `Markers`
- [ ] Set `decal_id`, `texture_path`, `size_px`, `decal_z_index`
- [ ] Place decals away from spawn/exit hotspots

3.3 Validation
- [ ] Export layouts:
  ```bash
  godot --headless --quit --script res://tools/export_layouts.gd
  ```
- [ ] Validate scenes:
  ```bash
  godot --headless --quit --script res://tools/validate_scenes.gd
  ```

Acceptance
- [ ] Decals render in‑game
- [ ] Decals do not affect walkmask/navmesh

---

## Phase 4 — Characters (Player + NPCs)
**Goal**: Replace placeholders with final sprites and clean animation.

4.1 Sprite generation
- [ ] Create 4‑direction sprite sheets (idle + 2 walk frames)
- [ ] Target height ~90–100px
- [ ] Transparent background, consistent baseline
- [ ] Fix white sticker outline if needed:
  ```bash
  magick input.png \
    \( +clone -alpha extract -morphology Erode Disk:8 \) \
    -compose CopyOpacity -composite \
    output.png
  ```

4.2 Integration
- [ ] Update `Player.tscn` with AnimatedSprite2D / AnimationPlayer
- [ ] Update `NpcAgent.tscn` similarly

4.3 QA
- [ ] No animation jitter
- [ ] Character scale feels consistent across scenes
- [ ] Player reads clearly against backgrounds

---

## Phase 5 — UI Chrome (Dialogue/Prompt/Debug)
**Goal**: Implement a cohesive sticker‑style UI.

5.1 Dialogue box
- [ ] Rounded rectangle panel
- [ ] Dark brown outline
- [ ] Legible font at 1280×720

5.2 Interaction prompt
- [ ] Small “Check” bubble above player
- [ ] Appears only within hotspot radius

5.3 Debug overlay
- [ ] Keep DebugLabel minimal
- [ ] Debug toggles remain functional (F2/F3/F4)

Acceptance
- [ ] Dialogue readable at a glance
- [ ] Prompt feels responsive

---

## Phase 6 — Full Pipeline QA + Playable Loop
**Goal**: Validate everything end‑to‑end with real art.

6.1 Full build
```bash
godot --headless --quit --script res://tools/build_content.gd
```

6.2 Runtime QA checklist
- [ ] Walk around every scene
- [ ] Verify exits work correctly
- [ ] Verify props block correctly
- [ ] Toggle debug overlays:
  - `F2` exits
  - `F3` overhangs
  - `F4` decals

6.3 Iteration loop
1) Update art/layout
2) Run `build_content.gd`
3) Run in editor and check UX
4) Adjust footprints/placements if needed

---

## Phase 7 — Polish Pass
**Goal**: Bring the demo to a cohesive, beautiful finish.

- [ ] Normalize palette across backgrounds + props
- [ ] Adjust prop scales for consistent readability
- [ ] Ensure decals are subtle and do not clutter paths
- [ ] Confirm player + NPC sprites contrast against backgrounds
- [ ] Verify UI chrome matches art direction

Acceptance
- [ ] Demo feels cohesive and readable
- [ ] No visual artifacts (seams/bleed/misaligned props)
- [ ] Walkability and navmesh feel natural
