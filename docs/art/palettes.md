# Palettes

## Structure
- `art/palettes/common.palette.json` (shared character/ink colors)
- `art/palettes/<biome>.palette.json`

## Rules
- UI + skin colors are global and immutable.
- Each biome adds colors for environment accents and VFX.
- Limit biome palettes to 24 colors per scene.
- All outputs are quantized to palette colors (no gradients).
