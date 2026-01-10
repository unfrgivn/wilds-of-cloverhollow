---
name: player-movement-camera
description: Implement top-down movement and camera for the Cloverhollow demo
compatibility: opencode
---
# Skill: Implement Player Movement + Camera (Exploration)

## Objective
Implement EarthBound-like overworld exploration movement: responsive, collision-safe, and visually stable.

## Steps

1) Create `scenes/player/Player.tscn`
Suggested node tree:
- `CharacterBody2D` (root)
  - `Sprite2D` (or `AnimatedSprite2D`) for visuals
  - `CollisionShape2D` (capsule/rectangle)
  - `Area2D` (`InteractionDetector`)
    - `CollisionShape2D` (circle/box in front of player, or around player)

2) Implement `scripts/player/Player.gd`
- Read input actions: `move_up/down/left/right`
- Build a move vector
  - normalize for diagonals
- Apply speed and move with `move_and_slide()`
- Track facing direction
  - minimum: 4 directions (N/S/E/W)
  - optional: 8 directions (N/NE/E/SE/S/SW/W/NW) if animations exist

3) Camera
- Add a `Camera2D` to follow the player.
- If using a low-res SubViewport, keep camera simple and let the viewport scaling provide stability.
- If not using SubViewport, consider snapping camera to whole pixels to reduce shimmer (only if needed).

4) Build a collision test scene
- `scenes/tests/TestRoom_Movement.tscn` with:
  - walls
  - a few obstacles
  - open space for diagonal movement checks

## Verification
- Player cannot pass through walls/obstacles.
- Diagonal movement is not faster than cardinal movement.
- Camera framing is consistent and non-jittery in the chosen rendering mode.
