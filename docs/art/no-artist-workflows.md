# No-artist workflows (pixel)

This repo is designed for people who do not draw.

Principle:
- AI produces raw images.
- The pipeline normalizes them into a consistent style (palette + sizing + packing).

Minimum tooling:
- palette quantization
- sprite validation
- sprite sheet packing
- deterministic recipes (prompt + seed + constraints recorded)

Do not manually “fix” assets in an editor without updating the source recipe.
