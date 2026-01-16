# Status

## Current
- Path B pipeline stages added (crop, plate bake) and runtime loads plates.
- New placeholder building and room shell props generated for Path B.
- `town_square_01`, `arcade_01`, and `school_hall_01` layouts updated to use building/room shell props.
- Ground plates regenerated for town, arcade, and school hall.

## Next
- Run `tools/build_content.gd` to regenerate scene.json, plates, walkmasks, and navpolys.
- Review baked `plate_base.png`/`plate_overhang.png` for cohesion and adjust prop positions/colors.
- Tighten interactive prop bake modes (live vs static) as interactions are finalized.
