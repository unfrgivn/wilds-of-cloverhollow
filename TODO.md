# TODO — Cloverhollow Demo

This is the living task list for the Cloverhollow demo. Updated as features are planned, refined, and completed.

## How to Use This File

- **Phases** group related work into logical milestones
- **Tasks** are specific, actionable items with clear "done" criteria
- Mark completed tasks with `[x]` and add completion date
- Move completed phases to the "Completed" section at the bottom
- Add new ideas to the "Backlog / Ideas" section for future discussion

---

## Phase 1: Core Systems (Foundation)

### Movement & Camera
- [ ] Player 8-direction movement with smooth acceleration
- [ ] Camera following with configurable smoothing
- [ ] Collision detection against static bodies
- [ ] Y-sorting for depth (walk behind props)

### Scene Management
- [ ] SceneRouter autoload with fade transitions
- [ ] Spawn point system (named Marker2D nodes)
- [ ] Door/warp interactables that trigger transitions
- [ ] Persist world state across scene changes

### Interaction System
- [ ] Interactable base interface (`get_interaction_prompt()`, `interact()`)
- [ ] Interaction detection (Area2D near player)
- [ ] Interaction prompt UI ("Press Z to Talk")
- [ ] Sign interactable (display text)
- [ ] NPC interactable (trigger dialogue)
- [ ] Container interactable (give item once, mark empty)

---

## Phase 2: UI Systems

### Dialogue Box
- [ ] EarthBound-style dialogue box (bottom of screen)
- [ ] Text typewriter effect with configurable speed
- [ ] Advance on input, close on final line
- [ ] Support for multi-page dialogue
- [ ] Speaker name display (optional)

### Inventory
- [ ] GameState inventory management (add/remove/count)
- [ ] Inventory UI panel (list of items)
- [ ] Item data resources (id, name, description, icon)
- [ ] "Use" action for usable items (Blacklight Lantern)

### HUD
- [ ] Currency counter display (Candy/Gems)
- [ ] Quick item indicator (equipped lantern state)

---

## Phase 3: Demo Content

### Locations
- [ ] Cloverhollow Town exterior (plaza + building entrances)
- [ ] Fae's House: Bedroom (starter room)
- [ ] Fae's House: Hall/Living room
- [ ] School interior (hall with lockers, bulletin board)
- [ ] Arcade interior (cabinets, claw machine, ticket counter)

### NPCs
- [ ] Mom NPC in Fae's house (2+ dialogue lines)
- [ ] Kid NPC in town (2+ dialogue lines)
- [ ] Weird NPC/creature hinting at mystery (Chaos Raccoon?)

### Items
- [ ] Journal (starter item in bedroom)
- [ ] Blacklight Lantern (quest item)
- [ ] Candy (collectible currency)

---

## Phase 4: Quest — "The Hollow Light"

### Quest Flow
- [ ] Obtain Blacklight Lantern (from container or NPC)
- [ ] Lantern toggle mechanic (on/off in inventory)
- [ ] Hidden sigil #1: School (revealed by lantern)
- [ ] Hidden sigil #2: Town or House (revealed by lantern)
- [ ] Arcade cabinet responds to lantern + sigils found
- [ ] End-of-demo stinger (eerie interaction, quest complete flag)

### Quest State
- [ ] Quest flags in GameState (`hollow_light.started`, `.sigil_1`, `.sigil_2`, `.completed`)
- [ ] Conditional dialogue based on quest progress
- [ ] Visual feedback for revealed objects

---

## Phase 5: Polish & Testing

### Visual Polish
- [ ] Consistent art style across all scenes
- [ ] Smooth animations (player walk cycle, NPC idle)
- [ ] Transition effects (fade timing, spawn positioning)
- [ ] Retro filter toggle (SubViewport scaling)

### Audio (Placeholders OK)
- [ ] Interaction sound effects
- [ ] Footstep sounds
- [ ] UI sounds (dialogue advance, menu)

### Testing
- [ ] GUT unit tests for GameState
- [ ] GUT integration tests for SceneRouter
- [ ] E2E test: complete quest from fresh start
- [ ] CI pipeline running headless tests

---

## Backlog / Ideas

Ideas for future consideration (not committed to demo scope):

- [ ] Controller support
- [ ] Save/load system
- [ ] Additional mini-games (claw machine prizes → inventory)
- [ ] More NPCs with branching dialogue
- [ ] Day/night cycle or time-based events
- [ ] Battle system foundation
- [ ] Additional quest content beyond "The Hollow Light"

---

## Completed

<!-- Move completed phases here with completion dates -->

