# Tileset pipeline (2D pixel)

## Goal
Build environments from reusable tiles, not bespoke painted scenes.

## Recommended minimum set (per biome)
Terrain:
- ground base tile
- path tile
- grass/water edge tiles (autotile set)
- water tile (if applicable)

Town kit:
- wall segments
- roof segments
- door/window tiles (optional)

## Output
- `art/tilesets/<biome>/source/*.png` (raw tile images)
- `art/tilesets/<biome>/atlas.png` (packed atlas)
- `game/assets/tilesets/<biome>/...` (runtime imports)

## Validation
- 16×16 per tile.
- Palette compliance.
- No anti-aliasing.
