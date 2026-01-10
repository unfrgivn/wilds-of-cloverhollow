---
name: cloverhollow-town
description: Build Cloverhollow town exterior and key buildings
compatibility: opencode
---
# Skill: Build Cloverhollow Town (Overworld)

## Objective
Create a small, readable town overworld that supports:
- exploration
- multiple building entrances
- early NPC interactions
- at least one quest-relevant hidden interaction (lantern reveal)

## Implementation options (choose one for the demo)
- **Option A:** TileMap-based town (fast iteration, easy collisions)
- **Option B:** Single painted backdrop + colliders/hotspots (matches the concept style quickly)

Both are acceptable as long as collision and interactables are clean and testable.

## Steps

1) Create `scenes/world/Cloverhollow_Town.tscn`
- Add clear navigation lanes.
- Add a recognizable landmark (e.g., center plaza).

2) Place building entrances
Minimum:
- Fae’s House
- School
- Arcade
Optional:
- Shop/Café

3) Add interactables
- At least:
  - 2 NPCs
  - 1 sign
  - 1 container (trash can/mailbox)
  - 1 hidden interaction revealed by the Blacklight Lantern (quest)

4) Add “edge exits” as teasers (optional)
- A path that is blocked with a sign (“Road closed”, “Come back later”, etc.)

## Verification checklist
- Player can traverse the town without getting stuck.
- Player can enter each demo building.
- Interactions are discoverable and readable (prompt appears in range).
