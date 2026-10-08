# Area kits

An area is painted whole, approved, and then split by `tools/art/kit.ts` into
a ground plate and props (spec 6.2). A prop is anything Fae can walk behind or
bump into; the plate is everything else, with the lifted props painted out.

## The rule for pixels
Every visible pixel of a prop's default state is the approved painting's. The
model only ever:

- paints the ground under a lifted prop and its cast shadow (plate holes);
- finishes the part of a prop hidden behind another prop (a bench's legs
  behind the fountain), so the prop stays whole when the front one moves;
- draws masks (which pixels are the object, which are its shadow).

New states (a smashed bench) are generated art, made from the cut prop as the
reference, and listed in the config with their own footprint.

Every kept sample in `art/source/areas/<area>/kit/` is the model's own output
for that subject and crop, as logged in the generation log. Never build one by
hand, from old cutouts or anything else: a sample that's wrong is fixed with
the config (a seed on the object, `front`, `exclude`, `core`) or drawn again.

## Steps
```sh
bun tools/art/kit.ts <area> gen     # two isolate samples a subject (+ two with its shadow)
bun tools/art/kit.ts <area> masks   # art/review/kit/<area>/masks-*.png: view every one
bun tools/art/kit.ts <area> fill    # completions, plate fills, frames, shadow decals, proofs
bun tools/art/kit.ts <area> pack    # atlas, catalogue, plate tiles, recipe, kept samples
bun tools/art/kit.ts <area> place   # places every unplaced prop at home in the area JSON
```

The first run moves the approved painting from `public/assets/areas/<area>/`
into `art/source/areas/<area>/painting/`; `pack` writes the plate back into the
runtime folder in the painting's own tiling, copying untouched tiles byte for
byte. Gemini outputs are cached in `art/scratch/kit/<area>/`, and `pack` keeps
the chosen ones (and each shadow mask) in `art/source/areas/<area>/kit/`, so a
rebuild from a clean checkout makes no calls. At most eight calls run at once
across every kit run on the machine. Each subject's samples record the crop
they were drawn from (`crop.json`, kept with them): change a crop and that
subject's cache is cleared and its kept samples passed over, so the next `gen`
draws it again from the new crop.

## The config: `art/kit/<area>.json`
`{ "area": "<id>", "subjects": [...] }`. A subject:

| Field | Meaning |
| --- | --- |
| `id` | The prop's id. |
| `crop` | `[x, y, w, h]` in units (2 painting px each): the whole object from its top to its feet, its shadow, its footprint, and its seed, with some context. Measure it on a `grid` image. Grown to the nearest aspect ratio the model takes. |
| `object` | What to keep, in words: name, shape, colours, where it is in the crop, and what not to keep ("not the tree"). |
| `ground` | What continues under it, for the fill ("the pale pink paving wash"). |
| `seed` | `[x, y]` in units, on the object: its mask is the component under the seed. |
| `footprint` | Polygons in world units where it meets the ground. One per leg for an arch; organic shapes (16+ vertices for a round basin). Never the whole silhouette. |
| `home` | Optional `[x, y]`; defaults to the footprint's southmost point, x at its centre. |
| `painted` | Stays on the plate (it overlaps a neighbour there): sorts and collides, but can't move or change state. |
| `canopy` | Fades while Fae is behind it (trees, signs). |
| `front` | Subjects drawn in front of it: their masks are cut from its own. |
| `complete` | Finish the parts its `front` subjects hide (lifted subjects only). |
| `solid` | Fill holes enclosed by the mask (a basin, a box). |
| `core` | For thin objects (arches): drop parts thinner than `2 * core + 1` px, which are neighbours' outlines. |
| `exclude` | Polygons in world units removed from the mask. |
| `shadowReach` | How far (px) its cast shadow may reach from it. Default 50. |
| `samples` | The chosen samples, `{ object, fill, complete }`, once viewed. Without one, the step makes several and picks (fill) or shows them (masks). |
| `states` | Extra states: `{ "<name>": { source, width, footprint, shadow } }`. |

## What is a prop
A prop is one object Fae can walk behind or bump into, and its picture is that
whole object, top to feet, and nothing else.

- Furniture that reads as one piece is one prop: a desk and its chair, a table
  and its chairs.
- Things fixed to a wall (boards, signs, murals, windows) are not props: they
  stay in the painting, since nobody walks behind them.
- Something solid that isn't an object (a pocket behind furniture nobody
  should enter, a gap too narrow to walk through, a strip along a wall) is a
  plain `blockers` entry in the area JSON, not part of a footprint.

## Choosing what's lifted
Lift what the story may move or break, and what stands clear of its
neighbours. Paint (`painted: true`) what overlaps others at the plate (an arch
across a bench) or fades into the painting's watercolour edge. A painted prop
can be lifted later by giving it a hole; nothing else changes.

## Footprints
Draw them on the painted ground contact with the unit grid
(`art/review/kit/<area>/` overlays), not by eye: a bench's footprint runs
through its leg feet; a lamp leg is a small ellipse at its base; a tree is its
trunk; a basin is its outer rim. Leave a gap only where someone fits through
standing up: an arch's legs get one ellipse each, but a board or sign whose
panel hangs low between its posts is a thin bar along its foot line, so nobody
walks through the panel. Collision is the footprint pushed out by the
collider's radius, so a footprint the size of the painted base reads right.

A footprint is its object's own ground contact and nothing more. One that
reaches past its object is an invisible wall, and its front edge sorts anyone
standing beside the object behind it; one that stops short of the object lets
Fae walk into the picture. Wall-backed furniture runs from the wall to its
front.

## Checks
`masks` reports each subject's problems. Errors, which `pack` refuses: a seed
outside its crop, or footprint points outside its crop (its picture can't reach
its own feet). Warnings: a mask that runs into an edge of its crop where the
painting goes on, so the object is cut off there or its mask has leaked into a
neighbour. Fix each warning (a bigger crop, `front`, `exclude`), or say in the
review why it's harmless: a treetop cut above everyone's heads is.

`just check` runs the area checks: interactables reachable, doors reachable,
party slots at every spawn, dens clear and in view, and no reachable spot more
than 75% hidden. A footprint that walls something off, or a prop that hides
Fae, fails there. `tests/unit/props.test.ts` checks every catalogue frame is in
its atlas, anchored, and a whole number of columns wide, and that every prop
is drawn whole: its picture covers every 5-unit column its footprint covers
(one may go spare at an end) and reaches to within 15 units of its front.

## Review
View every image in `art/review/kit/<area>/` before packing:

- `masks-<id>.png`: the samples, the final mask, the hole;
- `proof-<id>.png`: painting, plate, rebuilt, moved, cutout;
- `complete-<id>.png`: the input and each completion;
- `rebuilt-vs-painting.png` and `plate.png`.

Then, with the props placed:

- `bun tools/art/area-overlay.ts <area>`: green wherever Fae's feet can reach
  (the area checks' own flood fill), every prop footprint in every state, the
  doors, people, and look points. Green belongs only on open painted floor.
- `bun tools/art/depth-preview.ts <area> [x,y ...]`: for each prop, Fae where
  it hides the most of her and in front of it where they overlap most, drawn
  by the renderer's rule. She must be behind exactly what she stands behind.
- `bun tools/art/prop-frames.ts <area>`: every prop's picture as packed, on
  teal, with its footprint and front edge. Each picture is its object, whole,
  and nothing else: no wall, floor, or neighbour's outline. A picture reaching
  well below its front (`over`) usually carries a leaked line.

`pack` reports how many of the painting's pixels the rebuilt default layout
gets more than 12% wrong (the plaza: 0.66%, all along matte edges).
