# Product Specification — Layout-Authoritative Scene Pipeline Prototype

## 1. Product goal

Build a **layout-authoritative scene pipeline** in **Godot 4.5**. Scene structure, collisions, and triggers are defined externally via JSON and walkmask images, with automated validation that runs headlessly.

**Milestone 1:** A working prototype that can:
- Load scene layout from `scene.json`
- Block movement by sampling `walkmask.png`
- Trigger hotspots/exits defined only in JSON
- Validate bounds, walkability, and reachability headlessly

## 2. Technical baseline

- Engine: **Godot 4.5**
- Scripting: **GDScript**
- Rendering: **2D (CanvasItem)**
- Resolution: **1280x720** (16:9)
- Coordinate convention: **1 world unit = 1 pixel**, `(0,0)` is top-left

## 3. Non-negotiables

- **No tilemaps**
- **No hand-placed collision polygons for world blocking**
- Player blocking is **exclusively** from walkmask pixel sampling
- Hotspots/exits/spawns are defined **only** in JSON
- Triggers may use `Area2D` for overlap detection, but **not** for world blocking

## 4. Required project structure

```
res://main.tscn
res://core/SceneRunner.gd
res://core/Blueprint.gd
res://core/WalkMask.gd
res://actors/Player.tscn
res://actors/Player.gd
res://ui/DebugOverlay.gd (optional)
res://content/scenes/town_square_01/
  scene.json
  walkmask.png
  bg_ground.png
res://content/scenes/inn_01/
  scene.json
  walkmask.png
  bg_ground.png
res://tools/generate_placeholders.gd (recommended)
res://tools/validate_scenes.gd
```

## 5. Scene JSON schema (fixed)

```json
{
  "scene_id": "town_square_01",
  "assets": {
    "bg_ground": "bg_ground.png",
    "walkmask": "walkmask.png"
  },
  "spawn": { "id": "spawn_default", "x": 120, "y": 140 },
  "exits": [
    {
      "id": "to_inn",
      "rect": [ 420, 160, 48, 32 ],
      "target": { "scene_id": "inn_01", "spawn_id": "spawn_default" }
    }
  ],
  "hotspots": [
    { "id": "npc_test", "type": "talk", "x": 220, "y": 180, "radius": 18, "text": "Hello from town square." }
  ],
  "constraints": { "require_reachability": true }
}
```

All asset paths in JSON are **relative to the scene folder**.

## 6. Definition of Done (prototype)

A) Clean Godot project runs and loads a scene from `scene.json`.
B) Player moves with WASD and is blocked by walkmask (cannot enter black pixels).
C) Hotspots trigger on enter (Area2D overlap) and print (and optionally show UI text).
D) Exits trigger and switch to a second scene (or print + load).
E) Headless validator exists and checks:
   - required files exist
   - spawn/hotspot/exit bounds are inside the walkmask image
   - spawn/hotspot centers are on walkable pixels
   - reachability: each hotspot and each exit rect has at least one reachable walkable cell from spawn via BFS over the walkmask
F) Repo includes `docs/pipeline_prototype.md` explaining how to add a scene and run validation.
