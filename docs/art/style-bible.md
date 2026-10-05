# Cloverhollow art style bible

This is the small set of rules an art or code agent needs to make new assets
look like the approved concepts. The world is a child's watercolor dream, not
pixel art.

## Visual grammar

- **Line:** thin, slightly irregular warm-brown ink. Use `#5B3530` for the
  darkest contour and `#6D4339` for softer internal marks. Keep contours clean
  and readable at the 0.56x phone review size; do not use black outlines.
- **Color:** paper/ground `#F5F1E0`, peach skin `#EDB393`, warm terracotta
  `#A5664E`, Fae purple `#756492`, deep purple shadow `#52455F`, muted teal
  `#6A9DAA`, and navy `#3C619B`. Rainbow details may use small accents of
  coral, butter yellow, mint, and sky blue. Prefer softened, slightly warm
  colors over pure primaries.
- **Shading:** sparse watercolor washes with soft edges, usually one broad
  shadow and one small highlight per material. Preserve areas of paper and
  avoid glossy 3D rendering, hard cel-shading, or heavy gradients.
- **Light:** broad, friendly light from the upper left. Cast shadows are soft
  and short. Character sprites have no ground shadow baked into the alpha.
- **Proportion:** Fae's head, hair top to chin, is 38-40% of her total height,
  approximately 1:1.6 head-to-body. Keep the total at 140 logical units (280
  source pixels), shortening the body rather than enlarging the character.
  Hands and shoes are readable but simplified. Faces are friendly and calm.
- **Perspective:** environments are 3/4 overhead. Characters are seen from a
  slight high angle so shoes and feet sit convincingly on the ground plane.
- **Scale:** author at 2x source resolution. Fae is 140 logical units tall,
  approximately 280 source pixels from hair top to shoe sole. The current frame
  canvas is 384x384 source pixels, with opaque art at least 8px from the top and
  sides and a feet baseline at row 375.

## Sprite rules

Every frame uses the same transparent canvas, scale, and feet baseline. Keep
the backpack visible in left and up views. Right is a runtime mirror of left.
Use a clean alpha edge, no cream/green fringe, no baked floor, no cast shadow,
and no text. Walk frames should visibly alternate arm and leg positions while
the face, hair, star clip, hoodie, socks, shoes, and backpack remain stable.

## Reusable prompt blocks

**Style block:** “Cloverhollow watercolor-and-ink game sprite, thin warm-brown
ink contour, soft watercolor washes, warm pastel paper palette, gentle upper
left light, charming chibi child, clean readable silhouette, 2D painted asset,
not 3D, not pixel art.”

**Fae block:** “Fae, age ten, large chibi head, messy warm-brown hair with thick
bangs, chin-to-shoulder flyaway strands, small high bun or pony with grey hair
tie, silver star clip on one side, rosy cheeks and dot eyes, purple hoodie with
drawstrings and pocket, navy shorts, rainbow-striped socks, WHITE sneakers with
orange soles and trim, holographic sticker backpack with colorful stickers, and
a brown leather-bound journal peeking from the backpack top.”

**Maddie block:** “Maddie, Fae's chibi orange-and-cream tabby kitten, huge cute
head, warm peach-orange stripes, cream muzzle/chest/belly/paws, dark oval eyes,
pink nose and inner ears, blue collar with a small yellow star tag, fluffy
cream-tipped tail. Same watercolor washes and thin warm-brown ink as Fae.”

**Sprite block:** “single character only, transparent-looking flat pure green
background `#00FF00` for keying, no ground shadow, no text, evenly spaced
frames, identical scale and baseline, full body never cropped.”

## Do / don't

**Do:** preserve the approved Fae silhouette and colors; use the Sue sheet as
the rendering reference; leave breathing room around shoes and bun; check full
size and 0.56x size; keep alpha edges clean.

**Don't:** mix Fae's smooth digital concept rendering into the world without
watercolor ink treatment; use black outlines, neon colors, photorealism, 3D
lighting, motion blur, floor shadows, labels, props that obscure feet, or
different frame canvases.

For Maddie, read gait as a quadruped: diagonal leg pairs alternate, the tail
sways, and the front/back views remain head-on. Sitting idles use paws tucked
under the body and the tail curled around it. Maddie uses a 256x256 source
canvas, about 116px standing height and about 132px seated height, with an
anchor baseline at row 247. Those heights are posture results, not separate
scale targets: choose one scale from the model-sheet head and apply it to every
walk and idle source. A raised tail makes raw side-facing alpha heuristics
unreliable, so review Maddie's side row with an explicit left-facing arrow.

## Generation notes

For a character cycle, first generate one three-view model sheet, then generate
one six-frame horizontal strip per direction using a head-on front or back crop
as the sole pose reference for down/up. Generate the side strip separately and
flop it for the shipped left direction when it is clearly right-facing.
`gemini-3-pro-image` at 2K produced enough source pixels for the 280px target
figure and held Fae's clothing and backpack most consistently. Ask for a pure
`#00FF00` background, then segment strips by connected components rather than
equal-width slicing. Key out, despill green, erode the alpha rim by one pixel,
drop disconnected islands, and inspect the contact sheet on cream and dark
backgrounds. Keep the raw model sheet and selected strips in `art/source/`;
never ship extracted frames in the runtime folder.
