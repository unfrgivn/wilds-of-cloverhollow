# Art Pipeline Guide

This document describes the workflow for creating and integrating pixel art assets into Wilds of Cloverhollow.

For the authoritative locked tooling contract and acceptance commands, see
[`verified-pipeline.md`](verified-pipeline.md). This guide supplies art context;
the verified pipeline governs validation, quantization, packing, and baseline
evidence.

## Directory Structure

```
art/
├── palettes/               # Color palettes (JSON format)
│   ├── cloverhollow.palette.json
│   ├── enchanted_forest.palette.json
│   └── global_ui_skin.palette.json
├── source/                 # Source files (not imported to Godot)
│   └── ai/                 # AI-generated raw assets
└── recipes/                # Transformation recipes (future)

game/assets/sprites/        # Runtime assets (imported to Godot)
├── characters/             # Player, NPCs, enemies
├── props/                  # Environmental props
│   └── polished/           # Script-generated polished sprites
├── tiles/                  # Tilesets
└── ui/                     # UI elements

tools/art/                  # Art generation tools
└── generate_props.py       # Programmatic sprite generator
```

## Palette System

All sprites must use colors from biome palettes:

| Biome | File | Usage |
|-------|------|-------|
| Cloverhollow | `cloverhollow.palette.json` | Town, homes, shops |
| Enchanted Forest | `enchanted_forest.palette.json` | Forest areas |
| Bubblegum Bay | `bubblegum_bay.palette.json` | Beach areas |
| Global UI | `global_ui_skin.palette.json` | UI, skin tones, outlines |

### Palette JSON Format

```json
{
  "name": "cloverhollow",
  "version": 2,
  "colors": {
    "category_name": {
      "shade_name": "#hexcolor"
    }
  }
}
```

### Key Color Categories

- **ground**: Terrain, paths, cobblestones
- **wood**: Furniture, fences, buildings
- **foliage**: Trees, bushes, grass
- **flowers**: Decorative flowers (pink, purple, yellow, red, white)
- **metal**: Iron props, lamps, signs
- **outlines**: Colored outlines (brown, maroon, teal - NOT pure black)

## Creating Sprites

### Method 1: Programmatic Generation (Recommended for Props)

Use `tools/art/generate_props.py` to create pixel-perfect sprites:

```bash
uv run --locked --project . python tools/art/generate_props.py
```

Generated sprites go to `game/assets/sprites/props/polished/`.

To add new sprites:
1. Add a function like `create_bench()` defining pixel coordinates
2. Use colors from the `COLORS` dict (mapped to palette)
3. Call the function in `main()`
4. Copy output to `game/assets/sprites/props/`

### Method 2: Manual Pixel Art

For complex sprites requiring artistic judgment:

1. Reference `docs/art/concept-reference.md` for style
2. Use palette colors from `art/palettes/`
3. Export as PNG with transparency
4. Place in appropriate `game/assets/sprites/` subdirectory

### Method 3: AI Generation + Refinement

For supervised concept exploration only (not unattended or production use):

1. Generate with AI tools (results go to `nanobanana-output/`)
2. AI images are typically 2x+ oversized - expect downscale issues
3. Use for reference/inspiration, then recreate programmatically

## Sprite Specifications

| Type | Dimensions | Notes |
|------|------------|-------|
| Props (small) | 16×16 | Bench, planter, sign |
| Props (tall) | 16×32 | Tree, lamp, fence |
| Characters | 16×24 | Player, NPCs |
| Tiles | 16×16 | Ground, walls |
| Building facades | 48×64 | Shops, houses |

### Style Rules

1. **Outlines**: Colored (dark brown, maroon, teal) - never pure black (#000000)
2. **Shading**: 2-3 shade bands per material
3. **Lighting**: Top-left global illumination
4. **Scale**: Nearest-neighbor only, no anti-aliasing

## Testing Assets

After creating sprites:

1. Run the locked targeted validator for every changed asset, using its explicit size and biome/global palette union.
2. Inspect the changed PNGs natively and run the affected rendered scenario.
3. Use `just validate-assets` only as its documented two-bench smoke check, not as full-tree certification.
4. Follow [`verified-pipeline.md`](verified-pipeline.md) for quantization, packing, and reviewed baseline promotion.

## Workflow Summary

```
1. Check palette → art/palettes/{biome}.palette.json
2. Check style → docs/art/concept-reference.md
3. Create sprite → locked programmatic tool OR manual
4. Export → game/assets/sprites/{type}/
5. Test → Godot editor + smoke tests
6. Commit → Include in milestone commit
```
