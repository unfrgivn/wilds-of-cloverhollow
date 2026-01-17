# Decisions

## 2026-01-16 — Blender export + manifest defaults

- `ART_PADDING_PX = 2` for processed prop textures.
- `SHADOW_ALPHA = 0.5` for generated shadows.
- `SHADOW_OFFSET_PX = (0, 6)` applied during shadow generation.
- `SHADOW_BLUR_PX = 6.0` using `Image.gaussian_blur`.
- Blender template requires `RENDER_CAM`, `FOOTPRINT_CAM`, and `ANCHOR` at Z=0.
- Design kit textures live in `art/design_kit/` (placeholder until provided).
- Blender template defaults: render resolution `512x512`, `RENDER_CAM` orthographic (ortho_scale `512`, location `(0, -10, 10)`, rotation `(60°, 0°, 45°)`), `FOOTPRINT_CAM` orthographic (ortho_scale `512`, location `(0, 0, 10)`, rotation `(0°, 0°, 0°)`), `KEY_LIGHT` sun energy `3.0`.
- When multiple assets share a .blend file, sub-collections and anchors may be suffixed (e.g. `COL_BASE.001`, `ANCHOR_house_01`); the exporter treats `COL_*` prefixes as valid.
- Material library writes placeholder 1x1 images when design kit textures are missing.
- Placeholder design-kit textures generated at `128x128` in `art/design_kit/` (wood/stone/plaster/roof) until real textures are provided.

## 2026-01-17 — Concept-derived design kit textures

- Generated watercolor design-kit textures from `references/legacy_art/reference/concepts/` palettes.
- Files: `wood_planks_a.png`, `stone_blocks_a.png`, `roof_tile_a.png` at `1024×1024`, `plaster_a.png` at `1408×768`.
- Converted generated JPEG outputs to PNG via `sips` to satisfy Godot import requirements.
- Added variant B textures: `wood_planks_b.png`, `stone_blocks_b.png`, `plaster_b.png`, `roof_tile_b.png` from the same palette.
- Design-kit UV tiling scales: wood `4x`, stone `3x`, plaster `2x`, roof tiles `5x`.

## 2026-01-16 — Path B pipeline defaults

- **Plate baking implementation**: use `tools/bake_scene_plates.gd` (Godot Image API) for deterministic compositing without adding a Python/PIL dependency.
- **Crop strategy**: `tools/crop_prop_images.gd` overwrites `visuals/base.png` and `visuals/overhang.png` in place to avoid updating PropDef references.
- **Screenshot toggle**: `F9` forces debug overlays and markers off for clean captures.
- **Room shell placeholders**: initial room shell props use `960×540` textures, positioned at `(520, 640)` in `arcade_01` and `school_hall_01` layouts.

## 2026-01-16 — Working tree hygiene default

- Remove generated logs and artifacts created by headless runs.
- Keep tracked `.uid` files intact; leave existing untracked content alone unless it was explicitly created for Path B.

## 2026-01-16 — Blender sprite factory baseline

- Use Blender as the source of truth for prop/building/room shell sprites.
- Enforce transparent PNG exports with orthographic camera and bottom-center anchoring.

## 2026-01-16 — Blender export sync defaults

- `tools/sync_blender_exports.gd` maps `*_base.png`, `*_overhang.png`, and `*_shadow.png` into prop visuals.
- By default, missing prop folders are skipped unless `--allow-create` is provided.

## 2026-01-16 — Placeholder reset for Path B

- Regenerate placeholder prop packages for all layout references via `tools/generate_path_b_props.gd`.
- Ground-only generator writes a fully-walkable `base_walkmask.png` for town square.

## 2026-01-16 — Remove legacy kit test scene

- Drop `content/scenes/building_kit_test` to avoid exporting stale kit layouts.
