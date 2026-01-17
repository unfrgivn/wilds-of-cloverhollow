# Status

## Current
- Reset visuals to start fresh with Blender sprite factory pipeline.
- Placeholder props regenerated (buildings, rooms, hero prop set).
- Ground-only plates regenerated with walkable base mask.
- Removed `building_kit_test` scene to keep pipeline clean.
- Art QA blocks opaque backgrounds and checkerboards.
- Path B pipeline remains in place (crop, plate bake, plate rendering).
- Blender export sync tool added for prop visuals.
- Layouts use building/room shell props for Path B.
- Interaction hotspots now cover key town and interior props.

## Next
- Run `tools/sync_blender_exports.gd` to pull new Blender PNGs into prop visuals.
- Run `tools/crop_prop_images.gd`, `tools/qa_art.gd`, and `tools/bake_scene_plates.gd` after each art batch.
- Run `tools/build_content.gd` to rebuild scene.json, plates, walkmasks, and navpolys.
