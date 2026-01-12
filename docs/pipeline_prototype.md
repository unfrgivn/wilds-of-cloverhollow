# Layout-Authoritative World Pipeline Prototype

This prototype enforces layout authority from editor-authored layouts, exported JSON, and baked artifacts. Runtime loads only `scene.json` plus baked outputs, never `layout.tscn`.

## Folder structure

```
res://main.tscn
res://core/SceneRunner.gd
res://core/Blueprint.gd
res://core/WalkMask.gd
res://actors/Player.tscn
res://actors/Player.gd
res://actors/NpcAgent.tscn
res://actors/NpcAgent.gd
res://game/props/prop_def.gd
res://game/props/prop_instance.gd
res://game/tools/layout_root.gd
res://game/tools/markers/spawn_marker_2d.gd
res://game/tools/markers/hotspot_marker_2d.gd
res://game/tools/markers/exit_marker_2d.gd
res://game/tools/markers/decal_marker_2d.gd
res://game/tools/pipeline_constants.gd
res://content/decals/
  *.png
res://content/props/<prop_id>/
  <prop_id>.tscn
  <prop_id>_def.tres
  visuals/base.png
  visuals/overhang.png (optional)
  footprints/block.png
res://content/scenes/<scene_id>/
  layout.tscn
  ground.png
  base_walkmask.png (optional)
  scene.json
  _baked/
    walkmask_raw.png
    walkmask_player.png
    navpoly.tres
res://tools/export_layouts.gd
res://tools/qa_props.gd
res://tools/bake_walkmasks.gd
res://tools/bake_navpolys.gd
res://tools/build_content.gd
res://tools/validate_scenes.gd
```

## Scene JSON schema (v2)

```json
{
  "scene_id": "town_01",
  "size_px": [1280, 720],
  "assets": {
    "ground": "res://content/scenes/town_01/ground.png",
    "base_walkmask": "res://content/scenes/town_01/base_walkmask.png",
    "walkmask_raw": "res://content/scenes/town_01/_baked/walkmask_raw.png",
    "walkmask_player": "res://content/scenes/town_01/_baked/walkmask_player.png",
    "navpoly": "res://content/scenes/town_01/_baked/navpoly.tres"
  },
  "player_spawn": { "id": "spawn_default", "pos": [120, 140] },
  "props": [
    { "def": "res://content/props/tree_01/tree_01_def.tres", "pos": [240, 320], "variant": 0 }
  ],
  "decals": [
    { "id": "scuff_01", "texture": "res://content/decals/scuff_01.png", "pos": [300, 360], "size": [16, 16], "z_index": -2 }
  ],
  "hotspots": [
    { "id": "npc_test", "type": "talk", "pos": [220, 180], "radius": 18, "text": "Hello." }
  ],
  "exits": [
    { "id": "to_inn", "rect": [420, 160, 48, 32], "target": { "scene_id": "inn_01", "spawn_id": "spawn_default" } }
  ]
}
```

All coordinates are pixels with `(0,0)` at the top-left of `ground.png`.

Notes:
- `variant` selects an index in `PropDef.base_textures`/`PropDef.overhang_textures`.
- `decals` are visual-only and never affect walkmasks.

## Prop rules

- `PropDef.footprint_mask` uses **alpha only** (alpha > 0.5 blocks movement).
- `PropDef.footprint_anchor_px` is typically bottom-center.
- `variant` selects an index in `PropDef.base_textures`/`PropDef.overhang_textures`.
- Regenerating `visuals/base.png` or `visuals/overhang.png` never requires collision edits.


## Layout authoring

Each `layout.tscn` must include:
- `Ground` Sprite2D (centered=false at 0,0)
- `Props` Node2D with prop prefabs
- `Markers` Node2D with spawn/hotspot/exit/decal markers

Markers:
- `SpawnMarker2D` in group `marker_spawn`
- `HotspotMarker2D` in group `marker_hotspot`
- `ExitMarker2D` in group `marker_exit`
- `DecalMarker2D` in group `marker_decal`

## Build pipeline

Run the full pipeline:

```bash
godot --headless --quit --script res://tools/build_content.gd
```

Pipeline order:
1) `export_layouts.gd`
2) `qa_props.gd`
3) `bake_walkmasks.gd`
4) `bake_navpolys.gd`
5) `validate_scenes.gd`

Run steps individually:

```bash
godot --headless --quit --script res://tools/export_layouts.gd
godot --headless --quit --script res://tools/qa_props.gd
godot --headless --quit --script res://tools/bake_walkmasks.gd
godot --headless --quit --script res://tools/bake_navpolys.gd
godot --headless --quit --script res://tools/validate_scenes.gd
```

Prop QA modes:
- Default: validate only PropDefs referenced in exported scenes
- `--all`: validate every PropDef under `res://content/props/`

```bash
godot --headless --quit --script res://tools/qa_props.gd --all
```

## Regeneration safety rules

- `layout.tscn` is editor-only and never used at runtime.
- `scene.json`, `walkmask_raw.png`, `walkmask_player.png`, and `navpoly.tres` are authoritative runtime inputs.
- You may replace `visuals/base.png` or `visuals/overhang.png` anytime.
- Any layout change requires re-running `build_content.gd`.
