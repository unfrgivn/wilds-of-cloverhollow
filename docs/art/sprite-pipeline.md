# Sprite pipeline (2D pixel)

## Overworld (baseline)
- **8-direction**: N, NE, E, SE, S, SW, W, NW.
- Idle + walk animations for each direction.
- Diagonal movement uses diagonal sprites (not nearest-cardinal fallback).

## Direction naming convention
| Direction | Shorthand | Angle |
|-----------|-----------|-------|
| North     | N         | 0°    |
| Northeast | NE        | 45°   |
| East      | E         | 90°   |
| Southeast | SE        | 135°  |
| South     | S         | 180°  |
| Southwest | SW        | 225°  |
| West      | W         | 270°  |
| Northwest | NW        | 315°  |

## Battle sprites
- Separate folder from overworld.
- Start simple: one pose per character/enemy is fine; add animations later.

## Folder conventions
- `art/sprites/characters/<id>/overworld/<direction>/<anim>_<frame>.png`
- `art/sprites/characters/<id>/battle/<anim>/<frame>.png`
- `art/sprites/enemies/<id>/...`

Example: `art/sprites/characters/fae/overworld/ne/walk_01.png`

## Validation
- Transparent background.
- Correct frame sizes (documented per asset type).
- Palette compliance.
- All 8 directions must be present for overworld characters.
