# Art Pipeline — Path B Props + Plates

This document defines the prop hygiene rules and how to keep Path B scenes cohesive.

## Prop Package Structure
```
res://content/props/<prop_id>/
  <prop_id>.tscn
  <prop_id>_def.tres
  visuals/base.png               required, transparent
  visuals/overhang.png           optional, transparent
  visuals/shadow.png             optional, transparent
  footprints/block.png           required if blocks_movement=true
  _generated/shadow.png          generated if visuals/shadow.png missing
```

## Transparency + Padding
- `visuals/base.png` and `visuals/overhang.png` must have alpha transparency.
- No checkerboard or opaque backgrounds.
- Crop to alpha bounds and enforce `ART_PADDING_PX` transparent padding.
- `tools/crop_prop_images.gd` enforces this by overwriting the source images.

## Shadow Rules
- Blocking props must have a shadow.
- Use `visuals/shadow.png` or let `tools/generate_prop_shadows.gd` create `_generated/shadow.png`.

## Anchor Rules
- Prop root is the **feet/contact point**.
- Base/overhang sprites align bottom‑center at the prop root.
- Footprints use `footprint_anchor_px` (bottom‑center by default).

## Ground Plates
- `ground.png` is **ground only**: dirt, grass, paths, puddles.
- No buildings, walls, furniture, or vertical art.

## Buildings and Room Shells
- Buildings are props with base + overhang sprites and footprints.
- Room shells are large props that provide interior walls + floor.
- Walls can live in base and/or overhang depending on draw‑over needs.

## Bake Modes
- `static` props are baked into plates.
- `live` props remain instantiated at runtime (characters, interactables).

## Plate Baking
- `plate_base.png`: ground + static shadows + static base sprites
- `plate_overhang.png`: static overhang sprites
- `tools/bake_scene_plates.gd` produces both outputs deterministically.
