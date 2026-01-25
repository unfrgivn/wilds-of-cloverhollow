# Tile Workflow

This document describes how to create, validate, and integrate tiles for Wilds of Cloverhollow.

## Constraints (from spec.md)

- **Tile size**: 16×16 pixels
- **Scaling**: Nearest-neighbor only (no filtering)
- **Palette**: All tiles must use colors from biome palette + global palette only
- **Style**: Single pixel density, no resampling, clean shapes, 2-4 tones per material

## Directory Structure

```
art/
├── palettes/
│   ├── global_ui_skin.palette.json   # UI, skin tones, outline/ink
│   └── cloverhollow.palette.json     # Cloverhollow biome colors
├── tiles/
│   └── cloverhollow/                  # Source tiles per biome
│       ├── grass_01.png
│       └── ...
game/
└── assets/
    └── tiles/                         # Runtime tilesets (packed)
```

## Step-by-Step Workflow

### 1. Create the tile

Create a 16×16 PNG using only colors from the target biome palette + global palette.

### 2. Validate the tile

```bash
./tools/art/validate_sprite.sh art/tiles/cloverhollow/grass_01.png \
    --palette art/palettes/cloverhollow.palette.json \
    --grid 16
```

### 3. Quantize if needed

If the tile uses colors outside the palette, quantize it:

```bash
./tools/art/quantize_to_palette.sh \
    art/tiles/cloverhollow/grass_01.png \
    art/palettes/cloverhollow.palette.json
```

### 4. Pack into tileset

When all tiles for a biome are ready, pack them:

```bash
./tools/art/pack_spritesheet.sh \
    art/tiles/cloverhollow/ \
    game/assets/tiles/cloverhollow_tileset.png \
    --cols 16
```

### 5. Import in Godot

1. Drag the tileset PNG into Godot
2. Create a TileSet resource
3. Configure tile regions at 16×16 grid
4. Assign collision/navigation as needed

## Palette Files

Palette JSON format:
```json
{
  "name": "Cloverhollow",
  "colors": ["#2a3a4a", "#4a5a6a", ...]
}
```

## Validation Rules

1. Dimensions must be multiples of 16
2. All colors must exist in biome + global palette
3. No anti-aliasing or smooth gradients
4. No mixed pixel densities
