# Prompts

Store nano banana prompt templates here (treat them like code).

Suggested files:
- `fae_sprite_sheet.md`
- `npc_sprite_sheet.md`
- `room_backdrop_arcade.md`
- `room_backdrop_school.md`
- `props_icons.md`

## NPC Sprite Generation Guidelines

To avoid the "sticker outline" problem where sprites look pasted onto backgrounds:

### Required Prompt Constraints
Always include these in NPC/character prompts:
- "TRUE transparent background (no checkerboard pattern)"
- "NO white sticker outline or glow around character edges"
- "Thin dark brown/sepia ink outline only"

### Reference Sprite
Use `assets/sprites/npcs/kid/idle.png` as the gold standard — proper transparency, thin dark ink edge, no white border.

### If Sticker Outline Still Appears
Fix with ImageMagick morphological erosion (see `docs/art-pipeline.md` section 7):
```bash
magick input.png \
  \( +clone -alpha extract -morphology Erode Disk:8 \) \
  -compose CopyOpacity -composite \
  output.png
```
