# Product Specification — Composable World Pipeline Prototype

## 1. Product goal

Build a **layout-authoritative world pipeline** in **Godot 4.5**. Scene layout is authored in `layout.tscn`, exported to deterministic `scene.json`, and baked into walkmasks and navpolys. Runtime loads only `scene.json` plus baked outputs.

**Milestone 1:** A working prototype that can:
- Author layouts with props, decals, and markers in the editor
- Export `scene.json` deterministically
- Bake walkmasks and navigation from prop footprints
- Load baked artifacts at runtime
- Render prop variants and decals
- Validate bounds, walkability, and reachability headlessly

## 2. Technical baseline

- Engine: **Godot 4.5**
- Scripting: **GDScript**
- Rendering: **2D (CanvasItem)**
- Resolution: **1280x720** (16:9)
- Coordinate convention: **1 world unit = 1 pixel**, `(0,0)` is top-left

## 3. Non-negotiables

- **No tilemaps**
- **No hand-authored environment collision polygons**
- Player blocking is **exclusively** from baked walkmask sampling
- Props are prefab-based; collisions come from footprints only
- Regenerating prop art never requires collision edits
- Runtime ignores `layout.tscn` and uses only `scene.json` + baked artifacts
- NPC pathfinding uses baked `NavigationPolygon` from walkmask

## 4. Required project structure

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

## 5. Scene JSON schema (v2)

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

Notes:
- `variant` selects an index in `PropDef.base_textures`/`PropDef.overhang_textures`.
- `decals` are visual-only and never affect walkmasks.

## 6. Definition of Done (prototype)

A) Layout scenes exist and export to deterministic `scene.json`.
B) Prop QA validates referenced PropDefs without errors.
C) Bakers produce `_baked/walkmask_raw.png`, `_baked/walkmask_player.png`, and `_baked/navpoly.tres`.
D) Runtime loads props + baked assets and blocks player via `walkmask_player`, with prop variants and decals rendered.
E) NPCs navigate using the baked `navpoly`.
F) Validator checks bounds, walkability, and reachability against `walkmask_player` (including decal bounds).
G) `tools/build_content.gd` runs export → QA → bake → validate end-to-end.
