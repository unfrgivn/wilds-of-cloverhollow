# Pixel art style lock

This is a hard constraint document. If you violate it, the game will look inconsistent.

## Pixel density
- One pixel density only.
- No fractional scaling; nearest-neighbor only.

## Outlines and shading
- Prefer clean silhouettes.
- Use limited shading steps per material (2–4 tones).
- Avoid heavy texture noise.

## Palette rule
- All sprites and tiles must use:
  - the biome palette, plus
  - the global palette (UI + skin + outline)
- Any new colors require explicit palette updates.

## Tile grid
- Tile size: 16×16.
- Props should align to the tile grid (multiples of 16px when possible).
