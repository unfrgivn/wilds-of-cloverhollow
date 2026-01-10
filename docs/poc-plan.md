# POC Plan — Fully Playable Cloverhollow Demo (Godot 4.5)

This plan is optimized for an automated “opencode agent” workflow:
- implement in small, testable increments
- every phase ends with clear exit criteria
- headless test coverage grows alongside features

The target outcome is a **fully playable demo** (see `spec.md`) where Fae explores Cloverhollow, enters buildings, interacts with items/NPCs, and completes a short **weird-stakes** quest.

## Phase 0 — Repo + Godot 4.5 project bootstrap

### Deliverables
- Godot 4.5 project created (`project.godot`)
- Directory skeleton created:
  - `scenes/`, `scripts/`, `assets/`, `tests/`
- Input map actions defined (keyboard):
  - `move_up/down/left/right`, `interact`, `cancel`, `menu`
- Optional: low-res SubViewport “retro filter” prototype (toggleable)

### Exit criteria
- Project launches locally (editor run)
- Headless boot succeeds:
  - `godot --headless --path . --quit`
- Basic smoke script (optional) proves main scene can load without errors

## Phase 1 — Player controller + camera

### Deliverables
- `Player.tscn` with:
  - CharacterBody2D movement
  - 4/8-direction facing
  - basic animation states (idle/walk), placeholders acceptable
- Camera framing consistent across scenes

### Tests
- Unit tests for movement vector normalization (optional)
- Integration test loads a test scene and confirms:
  - player exists
  - player position changes after simulated input

### Exit criteria
- Fae can walk around a test room with collision bounds
- No jitter, no stuck-on-corners issues

## Phase 2 — Dialogue + interaction system

### Deliverables
- Dialogue UI:
  - textbox
  - “advance” behavior
  - close/cancel
- `Interactable` base:
  - `get_prompt()`
  - `interact(actor)`
  - interaction prompt appears when in range
- Interactable implementations:
  - Sign (text)
  - NPC (dialogue)
  - Container (gives item once)

### Tests
- Interaction test:
  - container gives item
  - container cannot be looted twice
  - NPC interaction opens dialogue and advances to completion

### Exit criteria
- In a test scene, the player can:
  - talk to NPC
  - check a sign
  - open a container and receive an item

## Phase 3 — Scene transitions + spawn points

### Deliverables
- `SceneRouter` autoload:
  - fade out → change scene → fade in
  - store and apply “next spawn id”
- Door/warp node:
  - target scene path
  - spawn id in destination scene
- Each location scene includes:
  - `SpawnPoints/<id>` markers

### Tests
- Transition test:
  - interacting with a door changes scene
  - player appears at correct spawn marker

### Exit criteria
- Player can enter/exit at least 2 scenes reliably

## Phase 4 — Build playable demo spaces

### Deliverables
- Town exterior: `Cloverhollow_Town.tscn`
  - clear pathing and collisions
  - entrances to house, school, arcade
  - at least 1 sign and 1 container
- Fae’s House:
  - bedroom (starter item pickup)
  - hall/living (navigation hub + flavor props)
- School hall interior:
  - lockers + bulletin board + trophy case
- Arcade interior:
  - multiple machines + ticket counter + claw machine

**Art integration:** start with placeholders, then replace with generated assets per `docs/art-pipeline.md`.

### Exit criteria
- Full exploration loop works:
  - town ↔ house ↔ town ↔ school ↔ town ↔ arcade

## Phase 5 — Quest implementation (“The Hollow Light”)

### Deliverables
- Inventory and quest flags in `GameState`
- Implement usable key item:
  - Blacklight Lantern (toggle on/off)
- Add at least 2 hidden interactions revealed by lantern:
  - one in School
  - one in Town (or House)
- Arcade final beat:
  - cabinet reacts (VFX + dialogue)
  - quest completion flag set
  - end-of-demo stinger (simple modal)

### Tests
- Quest test:
  - acquire lantern
  - reveal and interact with hidden object
  - complete quest sets completion flag

### Exit criteria
- Player can complete the micro-quest from a new game start without debug cheats

## Phase 6 — Automation hardening

### Deliverables
- Choose and install test framework:
  - **GUT** recommended for Godot 4.5
- Add `tools/ci/run-tests.sh`:
  - headless smoke boot
  - run GUT tests if configured
- CI workflow updated to:
  - install Godot 4.5.x
  - run `tools/ci/run-tests.sh`
  - upload reports/artifacts

### Exit criteria
- CI passes on PRs with deterministic results
- A failing test produces an actionable error and exits non-zero
