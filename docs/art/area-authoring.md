# Area authoring

Every area is a kit (spec 6.2): paint the area whole, get it approved, then
split it into a ground plate and props with `tools/art/kit.ts`
(`docs/art/kit.md` covers the scenery: props, their footprints, and depth).

An area JSON uses logical units, at two source pixels per unit. Trace the
walkable floor edge first. `blockers` are for what's solid but isn't a prop:
walls, the water's edge, pockets nobody should enter. A prop's footprint, its
own floor contact, comes from its kit.

Run `bun tools/art/area-overlay.ts bedroom` to draw the JSON over the two
painting tiles. The script writes `art/review/bedroom-overlay.png` and an SVG
source. Inspect the full-size PNG before accepting coordinates. Green marks
every spot Fae's feet can reach from a spawn, by the core's own collision
rule: it must cover only open painted floor, never furniture, the floor
behind it, or the paper outside the painting. Orange marks every prop
footprint in every state (dashed for painted props), magenta the doors (each
band covers its whole painted door), cyan the people's footprints (none
inside furniture), and violet each look point's interaction range. For a kit,
`bun tools/art/depth-preview.ts <area>` shows Fae behind and in front of each
prop, drawn by the renderer's rule.

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
