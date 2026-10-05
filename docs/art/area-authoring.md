# Area authoring

An area JSON uses logical units, at two source pixels per unit. Trace the
walkable floor edge first, then add only the floor-contact footprints to
`blockers`. A tall prop gets an `occluders` polygon covering its painted
silhouette and a `baseline` at the feet line. Keep the blocker smaller when a
player should be able to walk behind the prop.

Run `bun tools/art/area-overlay.ts bedroom` to draw the JSON over the two
painting tiles. The script writes `art/review/bedroom-overlay.png` and an SVG
source. Inspect the full-size PNG before accepting coordinates. Run
`bun tools/art/area-occluders.ts content/areas/bedroom.json` after changing an
occluder. It reassembles the painting, masks and crops each silhouette, and
writes lossless cutouts plus `occluders.json` beside the ground tiles.
Mask intermediates are written under `art/scratch/area-occluders/`; they are
never runtime assets. Keep blockers as complete floor-contact footprints, from
the wall edge to every visible leg or base, while occluder polygons describe
the taller painted silhouette.
