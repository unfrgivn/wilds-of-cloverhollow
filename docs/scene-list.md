# Scene List (Demo)

This is the **minimum** scene set to satisfy the demo acceptance criteria in `spec.md`.

## Bootstrap
- `scenes/bootstrap/Main.tscn`
  - Loads initial location scene
  - Owns the global fade layer (or references `SceneRouter`)
  - Instantiates/parents the Player if you keep the Player persistent

Optional:
- `scenes/bootstrap/Title.tscn` (New Game / Continue)

## Global UI
- `scenes/ui/UIRoot.tscn`
  - Dialogue box
  - Interaction prompt
  - Inventory panel (minimal list)
  - Counters (Candy/Gems)

## Player
- `scenes/player/Player.tscn`
  - Character controller
  - Animator
  - Interaction detector (Area2D)

## Town exterior
- `scenes/world/Cloverhollow_Town.tscn`
  - Town center landmark (plaza)
  - Entrances to:
    - Fae’s House
    - School
    - Arcade
    - (Optional) Shop/Café
  - Interactables:
    - at least 1 sign
    - at least 1 container (trash can / mailbox)

## Fae’s House (cutaway interiors)
- `scenes/interiors/FaeHouse_Bedroom.tscn`
  - Starter item pickup (e.g., Journal)
  - Bed interaction
  - Door to Hall/Living
  - Exit to town

- `scenes/interiors/FaeHouse_HallOrLiving.tscn`
  - Navigation hub to bedroom/exterior
  - At least 2 flavor interactables (e.g., phone/TV equivalent)

## School
- `scenes/interiors/School_Hall.tscn`
  - Bulletin board / trophy case / lockers
  - Hidden-sigil location for the Blacklight Lantern quest
  - Exit to town

## Arcade
- `scenes/interiors/Arcade.tscn`
  - At least 3 interactable machines
  - Quest completion beat (final reveal)
  - Exit to town

## Test scenes (recommended)
- `scenes/tests/TestWorld_Interaction.tscn`
- `scenes/tests/TestWorld_Transitions.tscn`
- `scenes/tests/TestWorld_Quest.tscn`
