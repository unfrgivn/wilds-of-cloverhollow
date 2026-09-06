---
name: sprite-pipeline
description: Create or review Cloverhollow overworld and battle sprite sets, packing, transparency, dimensions, and palette rules. Use for character, enemy, NPC, or animation sprite work.
compatibility: Godot 4.5.1, Python/ImageMagick helpers, Scenario Runner
---

# Sprite pipeline

Read `docs/art/sprite-pipeline.md`, `docs/art/style-lock.md`, and the relevant
asset docs. The project baseline is eight overworld directions (N, NE, E, SE,
S, SW, W, NW), with separate battle sprites. Do not reduce eight directions to
four or assume every sprite is 16x16; use documented asset dimensions.

Inspect existing assets and preserve transparent pixels. The Python validators
are placeholders, and `validate_sprite.sh` has known palette-format and
transparent-black pitfalls, so do not report their output as authoritative.
Fail closed when a required direction, frame, palette, or capture is missing.
For visual work, run a rendered scenario and read its trace, errors, completion,
and PNGs with image reading/vision. Do not use blanket quantization or OS
window automation.
