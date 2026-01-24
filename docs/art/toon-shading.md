# Pixel shading (3-step)

## Target
- 3 discrete light bands (highlight, mid, shadow)
- No gradients, no dithering
- Single key light from upper-left
- 1px ink outline on silhouettes

## Implementation notes
- Quantize colors through the palette at bake time
- Use nearest filtering for all pixel assets
- Keep shading ramps consistent across biomes via palette values (no separate ramp textures)
