# Visual Style Guide

This document defines the visual style rules for Wilds of Cloverhollow. All asset creators must follow these guidelines.

For detailed concept art references, see `concept-reference.md`.

## 1. Core Visual Principles

### 1.1 Pixel Art Constraints
- **Tile size**: 16×16 pixels (locked)
- **Internal resolution**: 512×288 (16:9 aspect ratio)
- **Scaling**: Nearest-neighbor only, no filtering
- **Pixel density**: Single scale throughout (no mixed-resolution sprites)
- **Outlines**: 1px dark brown or black outlines for readability

### 1.2 Tone and Mood
- **Target audience**: Kids 8–12, family-friendly
- **Vibe**: Cozy, safe, friendly, adventurous
- **Enemies**: Non-scary, cute creatures causing mischief
- **Violence**: Cartoon-style, no blood or gore

---

## 2. Character Design Guidelines

### 2.1 Proportions
- **Style**: Chibi/super-deformed
- **Head-to-body ratio**: 1:1.5 to 1:2
- **Height**: Characters fit within 16×24 to 16×32 pixels
- **Silhouette**: Must be readable at small scale

### 2.2 Character Elements
| Element | Guidelines |
|---------|------------|
| **Eyes** | Simple black dots or small ovals |
| **Faces** | Rosy cheeks/noses for warmth |
| **Hair** | Simple shapes, 2-3 shades max |
| **Clothing** | Distinct silhouettes, occupation signifiers |
| **Accessories** | Personality-revealing items |

### 2.3 Animation Requirements
- **Directions**: 8-direction sprites (N, NE, E, SE, S, SW, W, NW)
- **Walk cycle**: 2-4 frames per direction
- **Idle**: 1-2 frames per direction (optional breathing animation)

### 2.4 Character Color Rules
- Each character has a **signature palette** of 4-6 colors
- Skin tones use the **global skin palette** (see Section 4)
- Avoid pure black (#000000) except for outlines
- Hair colors: natural tones or stylized pastels

---

## 3. Environment Guidelines

### 3.1 Biome Style
Each biome has a distinct visual identity:

| Biome | Ground | Foliage | Accent Colors | Mood |
|-------|--------|---------|---------------|------|
| **Cloverhollow** | Warm tans, creams | Muted greens | Orange, purple | Cozy village |
| **Bubblegum Bay** | Pink sands | Pastel purples | Cyan, magenta | Whimsical beach |
| **Forest** | Dark browns | Deep greens | Amber, gold | Mysterious woods |
| **School** | Gray tiles | Indoor greens | Red, blue | Familiar, safe |

### 3.2 Tile Design
- **Seamless tiling**: All ground tiles must tile seamlessly in 4 directions
- **Autotile support**: Edge tiles for terrain transitions
- **Layering**: Ground → Props → Characters → UI

### 3.3 Prop Guidelines
| Prop Type | Size Range | Notes |
|-----------|------------|-------|
| Small (flowers, rocks) | 8×8 to 16×16 | Scattered decoration |
| Medium (benches, signs) | 16×16 to 32×16 | Interactive objects |
| Large (trees, buildings) | 16×32 to 48×64 | Landmarks |

### 3.4 Building Design
- **Facades**: 48×64 pixels standard
- **Roofs**: Terracotta, slate, or thatch textures
- **Windows**: Lit warmly at night phases
- **Doors**: Clear entry points, 16×24 minimum

---

## 4. Color Usage Rules

### 4.1 Palette Structure
```
Each biome has:
├── Biome Palette (8-16 colors)
│   ├── Ground tones (3-4 colors)
│   ├── Foliage tones (3-4 colors)
│   └── Accent colors (2-4 colors)
└── Global Palette (shared)
    ├── Skin tones (6 colors)
    ├── UI colors (8 colors)
    └── Outline/ink (2 colors)
```

### 4.2 Global Palette

#### Skin Tones
| Name | Hex | Usage |
|------|-----|-------|
| Pale | #FFE4D6 | Lightest skin |
| Light | #F5D0B9 | Light skin base |
| Medium | #D4A574 | Medium skin base |
| Tan | #A67B5B | Darker skin base |
| Deep | #6B4423 | Deep skin base |
| Warm | #8B5A2B | Highlight/shadow |

#### UI Colors
| Name | Hex | Usage |
|------|-----|-------|
| UI Background | #2D2D2D | Dialog boxes |
| UI Text | #FFFFFF | Primary text |
| UI Accent | #FFD700 | Highlights |
| UI Border | #8B4513 | Frame borders |
| UI Disabled | #666666 | Inactive elements |
| UI Success | #4CAF50 | Positive feedback |
| UI Warning | #FF9800 | Caution indicators |
| UI Error | #F44336 | Error states |

#### Outline Colors
| Name | Hex | Usage |
|------|-----|-------|
| Dark Outline | #2D1810 | Character/prop outlines |
| Black Ink | #1A1A1A | UI outlines, text |

### 4.3 Color Do's and Don'ts

**DO:**
- Use palette colors only (no color picking from photos)
- Quantize AI-generated art to biome + global palettes
- Use darker shades for shadows, lighter for highlights
- Apply consistent lighting direction (top-left source)

**DON'T:**
- Use pure white (#FFFFFF) for art (use off-whites)
- Use pure black (#000000) except for outlines
- Mix palettes between biomes
- Use gradients (use dithering instead)

### 4.4 Time-of-Day Tinting
| Phase | Modulate | Effect |
|-------|----------|--------|
| Morning | (1.0, 0.95, 0.9) | Warm sunrise |
| Afternoon | (1.0, 1.0, 1.0) | Neutral daylight |
| Evening | (1.0, 0.85, 0.7) | Orange sunset |
| Night | (0.6, 0.65, 0.85) | Cool blue |

---

## 5. Quick Reference Checklist

Before submitting art assets, verify:

- [ ] Correct pixel dimensions (16×16 base grid)
- [ ] Uses only palette colors (biome + global)
- [ ] 1px outlines are consistent
- [ ] No anti-aliasing or gradients
- [ ] Readable silhouette at 1x scale
- [ ] Tiles seamlessly (if applicable)
- [ ] All 8 directions provided (characters)
- [ ] Named according to convention (see `sprite-workflow.md`)

---

## 6. Related Documents

- `concept-reference.md` - Detailed concept art descriptions
- `palettes.md` - Palette file locations and formats
- `sprite-workflow.md` - Sprite creation process
- `tile-workflow.md` - Tileset creation process
- `style-lock.md` - Locked visual decisions
