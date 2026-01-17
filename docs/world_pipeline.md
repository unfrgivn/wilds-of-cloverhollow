# World Pipeline — Path B (Plate-Baked Scenes)

This project uses a layout-authoritative pipeline where `layout.tscn` is editor-only, and runtime loads only `scene.json` plus baked outputs. Path B bakes static props into scene plates for cohesion.

## Path B Rules
- **Ground plates only**: `ground.png` contains only ground surfaces and low decals.
- **Big forms are props**: buildings, walls, room shells, and large furniture are prop prefabs.
- **Scene plates**: static props are baked into `plate_base.png` and `plate_overhang.png`.

## Authoring
Each scene folder includes:
```
content/scenes/<scene_id>/
  layout.tscn
  ground.png
  base_walkmask.png (optional)
```
`layout.tscn` must include:
- `Ground` Sprite2D (centered=false, position=(0,0))
- `Props` Node2D with prop instances
- `Markers` Node2D with spawn/hotspot/exit/decal markers

### Bake Mode
Prop instances write a bake flag into `scene.json`:
- `static` → baked into plates (default)
- `live` → instantiated at runtime

Defaults come from `PropDef.default_bake_mode`, with optional per-instance override via `PropInstance.bake_mode`.

## Scene JSON (v2 + Path B)
`scene.json` includes plate assets and prop bake mode:
```json
{
  "assets": {
    "ground": ".../ground.png",
    "plate_base": ".../_baked/plate_base.png",
    "plate_overhang": ".../_baked/plate_overhang.png",
    "walkmask_player": ".../_baked/walkmask_player.png",
    "navpoly": ".../_baked/navpoly.tres"
  },
  "props": [
    { "def": "..._def.tres", "pos": [x, y], "variant": 0, "bake": "static" }
  ]
}
```

## Build pipeline (headless)
Run the full pipeline:
```bash
godot --headless --quit --script res://tools/build_content.gd
```

`tools/build_content.gd` runs these stages in order:
1) export_layouts
2) qa_props
3) process_prop_images
4) generate_prop_shadows
5) import_assets (`godot --headless --path . --import`)
6) qa_art
7) import_prop_manifests
8) bake_scene_plates
9) bake_walkmasks
10) bake_navpolys
11) validate_scenes

All tools operate on referenced assets by default. Use `--all` where supported.

## Runtime behavior
- `plate_base.png` renders as the ground layer (fallback to `ground.png` if missing).
- `plate_overhang.png` renders above `YSort` content.
- Only `bake="live"` props are instantiated at runtime.
- Player movement uses `walkmask_player.png` sampling.
- NPCs use `navpoly.tres` baked from the walkmask.
