# Sprite Workflow

This document describes how to create, validate, and integrate character/object sprites for Wilds of Cloverhollow.

## Constraints (from spec.md)

- **Grid**: 16×16 base (sprites can be multiples: 16×32 for tall characters)
- **Directions**: 8-direction facing (N, NE, E, SE, S, SW, W, NW)
- **Scaling**: Nearest-neighbor only
- **Palette**: All sprites must use colors from biome palette + global palette only

## Directory Structure

```
art/
├── palettes/
│   └── global_ui_skin.palette.json   # Skin tones, UI, outline colors
├── sprites/
│   ├── player/
│   │   ├── idle/                      # Idle animation frames
│   │   │   ├── frame_01.png
│   │   │   └── ...
│   │   └── walk/                      # Walk animation frames
│   └── enemies/
│       └── slime/
game/
└── assets/
    ├── sprites/                       # Runtime spritesheets
    └── party/                         # Party member sprites
```

## Step-by-Step Workflow

### 1. Create sprite frames

Create individual PNG frames for each animation:
- Use 16×16 or 16×32 dimensions
- Use only palette colors
- For 8-direction sprites, create variants: `walk_n.png`, `walk_ne.png`, etc.

### 2. Validate each frame

```bash
./tools/art/validate_sprite.sh art/sprites/player/idle/frame_01.png \
    --palette art/palettes/global_ui_skin.palette.json \
    --grid 16
```

### 3. Quantize if needed

If sprites use out-of-palette colors:

```bash
./tools/art/quantize_to_palette.sh \
    art/sprites/player/idle/frame_01.png \
    art/palettes/global_ui_skin.palette.json
```

### 4. Pack into spritesheet

```bash
./tools/art/pack_spritesheet.sh \
    art/sprites/player/walk/ \
    game/assets/sprites/player_walk.png \
    --cols 8
```

### 5. Import in Godot

1. Drag spritesheet into Godot
2. Configure AnimatedSprite2D or SpriteFrames resource
3. Set frame dimensions and animation properties

## 8-Direction Naming Convention

For character sprites with 8 directions:

| Direction | Suffix | Angle |
|-----------|--------|-------|
| North | `_n` | Up |
| Northeast | `_ne` | Up-Right |
| East | `_e` | Right |
| Southeast | `_se` | Down-Right |
| South | `_s` | Down |
| Southwest | `_sw` | Down-Left |
| West | `_w` | Left |
| Northwest | `_nw` | Up-Left |

## Animation Frame Naming

Number frames sequentially:
- `frame_01.png`, `frame_02.png`, `frame_03.png`, ...

Or by direction + frame:
- `walk_s_01.png`, `walk_s_02.png`, ...

## Validation Checklist

- [ ] Dimensions are multiples of 16
- [ ] All colors are in palette
- [ ] No anti-aliasing or gradients
- [ ] Consistent style across frames
- [ ] 8 directions for characters (if required)
