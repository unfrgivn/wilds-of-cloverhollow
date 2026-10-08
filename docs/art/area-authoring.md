# Area authoring

An area JSON uses logical units, at two source pixels per unit. Trace the
walkable floor edge first, then add only the floor-contact footprints to
`blockers`. A tall prop gets an `occluders` polygon covering its painted
silhouette and a `baseline` at the feet line. Keep the blocker smaller when a
player should be able to walk behind the prop.

Run `bun tools/art/area-overlay.ts bedroom` to draw the JSON over the two
painting tiles. The script writes `art/review/bedroom-overlay.png` and an SVG
source. Inspect the full-size PNG before accepting coordinates. Green marks
every spot Fae's feet can reach from a spawn, by the core's own collision
rule: it must cover only open painted floor, never furniture, the floor
behind it, or the paper outside the painting. Magenta marks the doors (each
band covers its whole painted door), cyan the people's footprints (none
inside furniture), and violet each look point's interaction range. Run
`bun tools/art/area-occluders.ts content/areas/bedroom.json` after changing an
occluder. It reassembles the painting, masks and crops each silhouette, and
writes lossless WebP cutouts plus `occluders.json` beside the ground tiles.
Mask intermediates are written under `art/scratch/area-occluders/`; they are
never runtime assets. Keep blockers as complete floor-contact footprints, from
the wall edge to every visible leg or base, while occluder polygons describe
the taller painted silhouette.

Doors are authored as `triggers` in the area JSON. The trigger polygon must be
reachable by the player centre, while each named spawn must remain at least two
player radii outside all triggers. Its target names the destination area and
spawn, and the spawn faces away from the doorway. `doorFadeTicks` controls the
deterministic out and in fades. Connection checks are test-time validation;
runtime content loading only parses the shape data.
Every spawn also needs a clear Maddie slot behind Fae, with perpendicular side
fallbacks when the rear slot is blocked. Keep enough open floor around doors
for both characters to arrive without intersecting furniture.
Keep the side heel slots open as well; follower validation rejects slots that
lack collision clearance or hide Maddie behind Fae.
