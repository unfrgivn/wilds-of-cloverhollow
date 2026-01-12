# Cloverhollow (Godot 4.5) — Layout-Authoritative Scene Pipeline Prototype

A fresh **Godot 4.5** prototype that proves a layout-authoritative scene pipeline. Scenes are defined by JSON and walkmask images, with headless validation to enforce correctness.

## Prototype goals
- Load scenes from per-folder `scene.json`
- Block movement using `walkmask.png` sampling (no tilemaps, no collision polygons for world blocking)
- Define hotspots, exits, and spawns only in JSON
- Validate scenes headlessly (bounds, walkable placement, reachability)
- Target resolution: **1280x720**, with **1 world unit = 1 pixel** and `(0,0)` at top-left

## Documentation
- Specification: `spec.md`
- Reference notes: `docs/reference_notes.md`

## Typical commands

Run editor:
```bash
godot --path .
```

Headless smoke boot:
```bash
godot --headless --path . --quit
```

Headless validator (after it is added):
```bash
godot --headless --path . --script res://tools/validate_scenes.gd
```

## IP / Legal
This project is an original technical prototype. Do not use copyrighted assets.
