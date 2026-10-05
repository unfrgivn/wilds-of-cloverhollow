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

Runtime keeps one PixiJS v8 atlas PNG and JSON per critter. Source generations,
extracted frames, and owner-review composites stay under `art/`. A source is
keyed from the green screen, despilled, alpha-eroded, trimmed, scaled, and
placed on the fixed canvas. Review sheets must show every frame on cream and
dark backgrounds before an atlas is accepted.
