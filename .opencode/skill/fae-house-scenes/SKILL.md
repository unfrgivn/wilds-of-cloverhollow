---
name: fae-house-scenes
description: Build Fae's house scenes matching EarthBound interior conventions
compatibility: opencode
---
# Skill: Build Fae’s House Scenes (Cutaway interiors, EarthBound-like staging)

## Objective
Create Fae’s House interiors that match the “cutaway room / dollhouse” staging seen in classic SNES RPGs,
while using original art consistent with `art/reference/concepts/`.

Minimum required rooms for the demo:
- Bedroom (starter room)
- Hall or Living room (navigation hub + flavor interactions)

## Steps

1) Bedroom scene: `scenes/interiors/FaeHouse_Bedroom.tscn`
- Backdrop:
  - use generated room image (preferred) or placeholder shapes
- Collision:
  - floor boundaries
  - block walls/furniture edges
- Interactables:
  - Bed (rest/flavor)
  - Desk/Container (starter item pickup, e.g., Journal)
  - 1–2 flavor props (poster, bookshelf, stuffed toy)

2) Hall/Living scene: `scenes/interiors/FaeHouse_HallOrLiving.tscn`
- Keep the layout simple and navigable.
- Interactables:
  - “phone/TV equivalent” (flavor + possible quest hint)
  - at least one decorative prop (plant, framed art)
- Doors:
  - link back to Bedroom and out to Town

3) Door wiring
- Use `Door` nodes and `SpawnPoints` markers for deterministic entry/exit.

## Verification checklist
- New game starts in Bedroom.
- Player can pick up the starter item.
- Player can reach Hall/Living and exit to Town.
