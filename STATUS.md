# Status

## Current
- Reset visuals to start fresh with Blender sprite factory pipeline.
- Placeholder props regenerated (buildings, rooms, core furniture set).
- Ground-only plates regenerated with walkable base mask.
- Art QA blocks opaque backgrounds and checkerboards.
- Path B pipeline remains in place (crop, plate bake, plate rendering).
- Layouts use building/room shell props for Path B.

## Next
- Regenerate placeholder props and ground-only plates.
- Run `tools/build_content.gd` to rebuild scene.json, plates, walkmasks, and navpolys.
- Swap placeholder props with Blender exports as they are produced.
