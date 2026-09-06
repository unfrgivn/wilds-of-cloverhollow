---
name: sprite-pipeline
description: "Create or review Cloverhollow overworld and battle sprite sets, packing, transparency, dimensions, and palette rules. Use for character, enemy, NPC, or animation sprite work."
compatibility: "Godot 4.5.1, locked Python/Pillow helpers, Scenario Runner"
---

# Sprite pipeline

Read `docs/art/sprite-pipeline.md`, `docs/art/style-lock.md`, and the relevant
asset docs. The project baseline is eight overworld directions (N, NE, E, SE,
S, SW, W, NW), with separate battle sprites. Do not reduce eight directions to
four or assume every sprite is 16x16; use documented asset dimensions.

Inspect existing assets and preserve transparent pixels. Use the locked `uv`
environment and implemented Python tools. Palette objects are read from their
nested `colors` field, repeated palettes form a union, fully transparent RGB
values are ignored, and each asset must be checked with its explicit `--size`
(characters may be 16x24). Fail closed when a required direction, frame,
palette, or capture is missing. See `docs/art/verified-pipeline.md` for the
authoritative commands. Validate every changed asset explicitly; `just
validate-assets` covers only its two selected bench samples, not the full tree.
For visual work, run a rendered scenario and read its trace, errors, completion,
and PNGs with image reading/vision. Do not use blanket quantization or OS
window automation.

For UI/dialogue evidence, previous visual approvals are untrusted. Inspect the
native attachment and corroborate trace/diff results with OCR plus the isolated
`tools/agents/review-capture.ts` reviewer. Exact transcription and clipped-label
checks are required; do not substitute a generic model approval.
