# Session Notes — Art Style Upgrade (January 2026)

## Summary

This session focused on upgrading all game artwork from placeholder pixel art to a cohesive cozy watercolor illustration style, and ensuring proper scaling/proportions for gameplay.

## Art Style Guide (Established)

All environment artwork should follow this style:

### Visual Characteristics
- **Technique**: Soft watercolor painting with diffuse warm lighting
- **Palette**: Warm pastels — cream, beige, soft lavender, muted pink, light blue, sunny yellow
- **Saturation**: Low saturation, high brightness
- **Outlines**: Dark brown/sepia (NOT black) — hand-drawn inked quality giving "sticker-like" definition
- **Perspective**: Isometric "dollhouse cutaway" / diorama view
- **Mood**: Cozy storybook simplicity — objects clearly readable but stylized

### What to Avoid
- Floating text labels or map-style markers (buildings can have natural signage above doors)
- Black outlines (use brown/sepia instead)
- High saturation or harsh shadows
- Cluttered walkways — keep paths clear for player movement
- Multiple doors in small rooms unless intentional

## Current Artwork Inventory

All stored in `assets/environments/` as `.jpg` files (~1200-1400px wide):

| File | Description | Dimensions |
|------|-------------|------------|
| `cloverhollow_town.jpg` | Town plaza with 5 buildings: Fae's House (top-left), School (top-center), Arcade (top-right), Café (bottom-left), General Store (bottom-right) | 1408x768 |
| `fae_bedroom.jpg` | Fae's bedroom with bed, desk, bookshelf, toy chest | ~1152x928 |
| `fae_living_room.jpg` | Living room with sofas, TV, stairs to upstairs | ~1200x896 |
| `fae_upstairs_hall.jpg` | Upstairs hallway connecting Fae's room and Oliver's nursery | ~1200x896 |
| `oliver_room.jpg` | Baby nursery with crib, rocking chair, changing table, dinosaur toys | 1408x768 |
| `school_hall.jpg` | School hallway with lockers, bulletin board, trophy case | 1408x768 |
| `arcade.jpg` | Arcade interior with cabinets, claw machine, ticket counter | ~1200x896 |

## Technical Configuration

### Viewport & Camera Settings
- **Viewport size**: 640x480
- **Window size**: 1280x960
- **Stretch mode**: viewport
- **Camera zoom**: 1x (changed from 2x to accommodate larger artwork)

### Player Sprite Scaling
- **Original sprites**: 32x32 pixels (in `assets/sprites/fae/`)
- **Sprite scale**: 3x (appears ~96px tall in-game)
- **Collision box**: 48x48
- **Interaction radius**: 60

### Background Positioning
Backgrounds are centered using half their dimensions:
- 1408x768 images → position `Vector2(704, 384)`
- 1200x896 images → position `Vector2(600, 448)`
- 1152x928 images → position `Vector2(576, 464)`

## Scene File Structure

Each location `.tscn` file includes:
1. **Background** — Sprite2D with environment artwork
2. **SpawnPoints** — Marker2D nodes for scene transitions
3. **Player** — Instance of Player.tscn
4. **Collisions** — StaticBody2D with CollisionPolygon2D nodes for walls/furniture
5. **Furniture** — StaticBody2D with CollisionShape2D for walkable obstacles
6. **Interactables** — Area2D nodes with interaction scripts (door, sign, container, npc)

## Image Generation Prompts

### Template for Interior Rooms
```
Isometric "dollhouse cutaway" view of [ROOM TYPE] for a 2D RPG game.

ART STYLE:
- Soft watercolor painting technique with diffuse warm lighting
- Warm pastel color palette: cream, beige, [ACCENT COLORS]
- Low saturation, high brightness
- Dark brown/sepia outlines (NOT black) - hand-drawn inked quality
- Stylized storybook simplicity

SCENE CONTENT:
[DETAILED ROOM LAYOUT - specify furniture positions, wall decorations]

CRITICAL:
- Only ONE door (exit on bottom/front wall)
- Keep entrance and walking path CLEAR of obstacles
- NO floating text labels

NO TEXT. No labels.
```

### Template for Exterior/Town
```
Top-down isometric "dollhouse cutaway" view of [LOCATION] for a 2D RPG game.

ART STYLE:
[Same as interior]

SCENE CONTENT:
[BUILDING POSITIONS AND FEATURES]

IMPORTANT: 
- Buildings can have small natural signage above doors
- NO floating explanatory labels like "School" or "Arcade" 
- This is a game environment, not a labeled map
```

## Character Reference

Fae's design (from `art/reference/concepts/characters/character_concept_sheet_fae.png`):
- Messy brown hair with small ponytail and star hair clip
- Purple oversized hoodie
- Dark navy shorts
- Rainbow striped socks
- White sneakers with orange accents
- Glittery holographic backpack with star/heart stickers
- Rosy cheeks, dot eyes, small smile
- Chunky cute proportions

## Family Notes

- **Oliver**: Fae's baby brother, lives in the nursery. Obsessed with dinosaurs.
- **Mom**: Found in living room, mentions Oliver and the town festival.

## Debug Tools

- **F3**: Toggle coordinate debug overlay — click anywhere to log world coordinates to console
- Useful for mapping collision polygons and spawn points

## Commits This Session

1. `feat: upgrade artwork to cozy watercolor style with proper scene collisions`
2. `fix: remove extra door from Oliver's nursery artwork`
3. `fix: clear walkway in Oliver's nursery, reduce floor clutter`

## NPC Sprite "Sticker Outline" Fix (January 2026)

### Problem
Generated NPC sprites (mom, old_man) appeared as "stickers superimposed on the background":
- Thick white border baked into the artwork making characters look pasted-on
- Some sprites had fake checkerboard transparency instead of real alpha channel
- The kid NPC was correct (proper transparency, thin dark ink edge, no white border)

### Root Cause
The nano banana image generation tool sometimes produces sprites with:
1. White "sticker outline" painted INTO the artwork (not just edge artifacts)
2. Fake transparency patterns instead of true RGBA alpha channel

### Solution: ImageMagick Morphological Erosion
Simple transparency operations don't work because the white border is painted into the art. Use morphological erosion to shrink the alpha mask, effectively removing the outer white ring:

```bash
# Remove ~8 pixel white sticker border while preserving character art
magick input.png \
  \( +clone -alpha extract -morphology Erode Disk:8 \) \
  -compose CopyOpacity -composite \
  output.png
```

**How it works:**
1. `+clone -alpha extract` — extracts the alpha channel as grayscale
2. `-morphology Erode Disk:8` — shrinks the mask inward by ~8 pixels
3. `-compose CopyOpacity -composite` — applies the eroded mask back

**Adjust the erosion amount:**
- `Disk:4` — light erosion (thin white borders)
- `Disk:8` — standard (most generated sprites)
- `Disk:12` — aggressive (very thick white borders)

### Files Fixed
| File | Issue | Fix Applied |
|------|-------|-------------|
| `assets/sprites/npcs/mom/idle.png` | White sticker outline | Disk:8 erosion |
| `assets/sprites/npcs/old_man/idle.png` | Fake transparency + white outline | Disk:8 erosion |

Backups saved as `idle_broken.png` in each folder.

### Post-Fix Godot Import
After replacing sprite files, Godot's import cache may be invalid:
```bash
# Delete stale import files
rm assets/sprites/npcs/*/idle.png.import

# Reimport
godot --headless --path . --import
```

### Prevention for Future Sprites
Add these constraints to NPC generation prompts:
- "TRUE transparent background (no checkerboard pattern)"
- "NO white sticker outline or glow around character edges"
- "Thin dark brown/sepia ink outline only (matching kid NPC reference)"

Reference the working sprite: `assets/sprites/npcs/kid/idle.png`

### Walk Animation Sprites
The `walk1.png` and `walk2.png` files likely have the same sticker issue and will need the same erosion treatment when addressed.

## Next Steps

1. Fine-tune collision polygons using F3 debug tool during playtesting
2. Generate proper high-res Fae sprites with transparency (current sprites are 32x32 scaled 3x)
3. Add remaining NPC sprites (Mom, Arcade Worker, Mysterious Stranger)
4. Implement the Blacklight Lantern mechanic and hidden sigils
5. Complete "The Hollow Light" quest flow
6. Apply erosion fix to walk animation sprites (walk1.png, walk2.png) for all NPCs
