# Decisions

## 2026-01-16 — Path B pipeline defaults

- **Plate baking implementation**: use `tools/bake_scene_plates.gd` (Godot Image API) for deterministic compositing without adding a Python/PIL dependency.
- **Crop strategy**: `tools/crop_prop_images.gd` overwrites `visuals/base.png` and `visuals/overhang.png` in place to avoid updating PropDef references.
- **Screenshot toggle**: `F9` forces debug overlays and markers off for clean captures.
- **Room shell placeholders**: initial room shell props use `960×540` textures, positioned at `(520, 640)` in `arcade_01` and `school_hall_01` layouts.
