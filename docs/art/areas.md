# Area art notes

## Bedroom

- A 3:2 generation frame works well for the 3000x2000 source canvas. Resize by
  height-preserving aspect ratio, then center-crop the small ratio difference.
- Ask for a strict cutaway room, back wall across the top, thin angled side
  walls, and no front wall. Explicitly state that the floor must fill at least
  two thirds of the frame and that the route to the back-wall door must stay
  open.
- The most reliable prompt order was: camera and walkability first, furniture
  placement second, then the watercolor/ink style block and exclusions. The
  door needs to be called out as unmistakable and centered or slightly offset
  on the back wall.
- Supplying Fae's idle frame as a scale-only reference made the door and bed
  proportions easier to judge. Keep the instruction that the character must
  not appear in the generated background.
- Simple picture posters are safer than requested writing. Even with a no-text
  instruction, some variants produced pseudo-writing, so inspect the full-size
  output and choose the cleanest one before tiling.

## Scale rule (owner-approved 2026-10-05)

- Gemini paints furniture too large even with Fae's sprite as a scale
  reference: the first bedroom had a door twice her height and a bed nearly
  three times her length. Measure, then resample; never stretch.
- Target: a standard door is about 1.4x Fae's height (about 200 logical units,
  400 source px). A bed is about 1.3x her height long. Scale the whole painting
  uniformly until the door matches.
- The bedroom ships at 70% of its first composition: 2100x1400 source px,
  1050x700 logical units, so it fits on one phone screen with paper margins.
- Record the painting's paper margin colour in `ground.json` (`paper`). The
  game fills the view with it so the painting has no visible edge.
- Check scale by compositing Fae's idle frame at her feet in several floor
  spots, then mock a phone view (720 logical units tall) before approval.

## Plaza

- The bedroom is the best style reference: pass its assembled ground image,
  not a concept sheet, so the plaza inherits the approved watercolor density,
  warm-brown line, and paper warmth.
- Gemini consistently made storefronts and doors too large. Put the target in
  the prompt twice: doors about 400 source px against Fae's 280px frame, and
  each facade about one sixth of the image width. Measure the result and use
  uniform resampling plus paper padding when needed; never stretch the scene.
- A wide plaza reads best with the fountain near center, the house at a side
  edge, shops on the far edge, and three broad routes radiating through the
  open ground. Pictorial signs avoided most lettering artifacts.
- For the phone review, use a 1565x720 logical viewport (3130x1440 source px)
  and render it at 1748x804. Keep the house door in the crop because it is the
  most important transition and scale anchor.
