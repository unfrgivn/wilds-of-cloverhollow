# Cloverhollow (Godot 4.5) — Composable World Pipeline Prototype

A Godot 4.5 prototype that proves a **layout-authoritative** world pipeline. Author scenes in `layout.tscn`, export deterministic `scene.json`, bake walkmasks/navpolys, and load baked assets at runtime.

## Prototype goals
- Author scenes with props, decals, and markers in editor-only `layout.tscn`
- Export deterministic `scene.json` (placements, spawn, exits, hotspots, decals)
- Bake `walkmask_raw`, `walkmask_player`, and `navpoly`
- Block player movement by sampling `walkmask_player`
- Render prop variants and decals
- Drive NPC pathfinding from baked `navpoly`
- Validate scenes headlessly

## Documentation
- Specification: `spec.md`
- Pipeline guide: `docs/pipeline_prototype.md`
- UX design plan: `docs/ux_design_plan.md`
- Reference notes: `docs/reference_notes.md`

## Typical commands

Run editor:
```bash
godot --path .
```

Build content (export → QA → bake → validate):
```bash
godot --headless --quit --script res://tools/build_content.gd
```

Validate scenes only:
```bash
godot --headless --quit --script res://tools/validate_scenes.gd
```

## IP / Legal
This project is an original technical prototype. Do not use copyrighted assets.
