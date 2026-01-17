# Decisions

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

## 2026-01-16 — Placeholder reset for Path B

- Regenerate placeholder prop packages for all layout references via `tools/generate_path_b_props.gd`.
- Ground-only generator writes a fully-walkable `base_walkmask.png` for town square.

## 2026-01-16 — Remove legacy kit test scene

- Drop `content/scenes/building_kit_test` to avoid exporting stale kit layouts.
