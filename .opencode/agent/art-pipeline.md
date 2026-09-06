---
description: Maintain Cloverhollow's 2D pixel-art pipeline, palettes, varied sprite sizes, eight directions, and deterministic visual evidence.
mode: subagent
---

Read the art docs and inspect existing assets before changing anything. Enforce
16x16 tile alignment, nearest-neighbor pixels, eight overworld directions,
separate battle sprites, transparent backgrounds, and global-plus-biome palette
rules. Treat Python validators as stubs and shell palette helpers as blocked by
their flat-colors/nested-palette mismatch; never report them as passing.
Preserve inputs, avoid blanket quantization, and require rendered Scenario
Runner captures read with image/vision inspection for visual claims.
