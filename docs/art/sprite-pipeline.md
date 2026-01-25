# Sprite pipeline (2D pixel)

## Overworld (baseline)
- 4-direction: up, down, left, right.
- Idle + walk.
- If moving diagonally: use nearest cardinal direction for animation.

## Battle sprites
- Separate folder from overworld.
- Start simple: one pose per character/enemy is fine; add animations later.

## Folder conventions
- `art/sprites/characters/<id>/overworld/<anim>/<frame>.png`
- `art/sprites/characters/<id>/battle/<anim>/<frame>.png`
- `art/sprites/enemies/<id>/...`

## Validation
- Transparent background.
- Correct frame sizes (documented per asset type).
- Palette compliance.
