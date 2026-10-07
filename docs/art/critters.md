# Critter sprite rules

Chaos-touched critters keep the approved animal silhouette and use a playful,
non-scary chaos language: purple-and-teal spiral eyes, loose purple scribbles,
small purple sparkles, and soft pink bubbles where the story calls for them.
The marks must read as mischief, not danger. Soothed critters may retain a few
fading marks; calm critters return to their normal dot eyes and friendly face.

Critter frames are authored at 512x512 source pixels for close battle views.
The figure is about 380 pixels tall, has an 8-pixel bottom baseline margin, and
keeps at least 8 pixels of clearance on every edge. All states use one uniform
scale and a shared baseline. Bubble effects may extend the silhouette only in a
burst frame and must remain inside the canvas. Every shipped frame uses a
0.5 horizontal anchor and a baseline anchor of 504/512.

Runtime keeps one PixiJS v8 atlas PNG and JSON per critter. The chaos aura is
a separate single-frame layer, drawn behind the body and faded independently.
Source generations live in `art/source/critters/<name>/`; extracted frames and
owner-review composites stay in the gitignored `art/scratch/` and `art/review/`.
Body sources are generated on a key colour the critter doesn't use (magenta,
`#FF00FF`, for the green frog), keyed by flood fill from the canvas border so
interior colour is never removed, despilled only in a three-pixel alpha-edge
band, trimmed, scaled uniformly, and placed on the fixed canvas. Review sheets
must show every frame on cream and dark backgrounds before an atlas is
accepted.

`bun tools/art/build-frog.ts` rebuilds the frog atlas byte-for-byte from the
selected sources and the recipe; `bun tools/art/critter-check.ts` runs the
critter checks configured in `art/recipes/frog.json`.

Every body frame must also pass three checks that no recipe can loosen. The
recipe's `bodyHue` range may be at most 0.3 wide (a range of 0 to 1 accepts any
colour; the frog's is 0.28). No opaque pixel may still be either key colour,
whichever key the frame was keyed on. And no straight edge of 16 px or more may
be light paint: a run that is opaque on one side and clear on the other is a
crop cutting through the figure unless its edge is dark ink. The pup's back is
an ink outline 25 px straight, which passes. Build scripts find whole figures by
connected components; they never crop to fixed panels or cells.

Aura layers are not chroma-keyed. Purple is deliberately close to the magenta
key and any translucent glow would make a single-key matte unreliable. The frog
aura is lifted from white paper with colour-to-alpha: white becomes transparent
and pigment becomes soft alpha-colour. The shipped painted aura uses one
uniformly scaled 512px frame; the engine rotates and pulses it for motion. It
is drawn behind the body. No black matte, vector outline, or hard ring is
introduced during extraction.

Aura checks use the matte method declared in the recipe. White-lifted effects
are not judged by the magenta-key test. Neutral black ink means alpha above 128,
luminance below 60, and saturation below 0.25; saturated dark watercolor is
legitimate pigment. The checker also requires at least 35% soft visible pixels,
70% purple/violet/plum or teal hue coverage, and 8px clearance.
