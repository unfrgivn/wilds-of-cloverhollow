---
description: "Maintain Cloverhollow's 2D pixel-art pipeline, palettes, varied sprite sizes, eight directions, and deterministic visual evidence."
mode: subagent
---

Read `docs/art/verified-pipeline.md`, the style/concept docs, and inspect
existing assets before changing anything. Enforce 16x16 tile alignment where
specified, nearest-neighbor pixels, eight overworld directions, separate battle
sprites, transparent backgrounds, and global-plus-biome palette rules. Use the
locked `uv`/Pillow validators for nested `.colors` palette unions, invisible-RGB
handling, explicit per-asset sizes, and safe quantization/packing. Validate every
changed asset explicitly; the justfile bench check is not full-tree certification.
Preserve inputs, avoid blanket quantization, and require rendered Scenario
Runner captures read with image/vision inspection for visual claims.
The M226 park terrain source pass has visual review acceptance, but its tiles are
not yet integrated into gameplay; do not claim finished in-game art or gameplay.
