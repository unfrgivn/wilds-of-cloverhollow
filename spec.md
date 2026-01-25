# Wilds of Cloverhollow — spec

Last updated: 2026-01-25

This file is the single source of truth. If code changes behavior, update this file in the same commit.

## 1. Product definition

### 1.1 Audience and tone
- Target audience: kids 8–12; family friendly.
- Tone: cozy, safe, friendly; cute animals; fun puzzles; light combat with non-scary enemies.
- Core premise: stop a “bad guy” causing chaos in town while balancing school life.

### 1.2 Pillars
1. Cozy exploration with readable pixel art.
2. Light puzzles and item/tool gating.
3. Turn-based battles that are fast and clear.
4. Lots of reuse (tiles, props, sprites) to scale content reliably.

## 2. Platform and constraints
- Platform: iOS native.
- Orientation: landscape only.
- Development: macOS only.
- Engine: Godot 4.x.
- Automation constraint: agents must not rely on OS-level window control to playtest; testing must run through an in-game Scenario Runner and deterministic artifacts.

## 3. Presentation

### 3.1 Overworld
- 2D pixel art.
- Classic 3/4 overhead JRPG look (top-down-ish).
- No camera rotation.

### 3.2 Pixel grid and scaling (locked)
- Tile size: **16×16**.
- Internal base resolution (logical): **512×288** (16:9).
- Rendering: scale up with nearest-neighbor; no filtering.
- Camera: Camera2D must move on whole pixels (no shimmer).
- Player position snaps to integers after `move_and_slide()` for pixel-stable rendering.

### 3.3 Movement (locked)
- Free analog movement.
- Facing/animation: **8-direction** (N, NE, E, SE, S, SW, W, NW).
  - All character and NPC sprites must include 8-direction variants.
  - Diagonal movement uses diagonal sprites (not nearest-cardinal fallback).

### 3.4 Encounters (locked)
- Visible overworld enemies.
- Colliding with or triggering an enemy starts a battle.

### 3.5 Interaction system
- Player has an InteractionArea (Area2D) for detecting nearby interactables.
- Interactable objects (signs, NPCs) extend the `Interactable` base class.
- Pressing the "interact" action triggers dialogue or other interaction.
- DialogueManager autoload handles showing/hiding dialogue UI.
- Player movement is disabled while dialogue is showing.

### 3.6 Area transitions
- SceneRouter autoload manages scene changes and player spawn placement.
- Areas contain SpawnMarker nodes (string-based IDs like "from_forest", "default").
- AreaTransition zones (Area2D) trigger scene changes when the player enters.
- Transitions specify target area path and target spawn marker ID.
- Player is repositioned to the spawn marker after area load.

## 4. Party and characters
- Party size: 4 total (main character + 2 additional + pet).
- Overworld: party followers are allowed; equal size and consistent spacing.

## 5. Battle system

### 5.1 Battle format (locked)
- Classic turn-based JRPG battle screen.
- Pre-rendered **pixel** battle backgrounds (static image to start).
- Battles must be playable early with placeholder art.

### 5.2 Battle UI (locked preferences)
- HUD framing: enemy + party status at the top (HP/MP/status readability).
- No cassette theming.
- No large themed “device bar”.
- Boxes are acceptable for v0, but the UI must remain readable at iPhone landscape scale.

## 6. Art direction and determinism

### 6.1 Key rule
**All art must be normalizable and consistent.** AI outputs are treated as raw inputs; the pipeline enforces style.

### 6.2 Palettes (locked)
- Each biome has a palette.
- There is a shared global palette for UI + skin tones + outline/ink.
- All tiles/sprites must quantize to: biome palette ∪ global palette.

### 6.3 Pixel style constraints (locked)
- Single pixel density (no mixed-scale sprites).
- No resampling; nearest-neighbor only.
- Avoid noisy textures; prefer clean shapes and limited shading bands per material.

## 7. World structure (content)
- Discrete areas/scenes are allowed (and preferred for simplicity).
- Biomes/towns planned: Cloverhollow (main town), Bubblegum Bay, Pinecone Pass, Enchanted Forest, Forest/Clubhouse Woods, and more (8+ total).

## 8. Automation and agentic workflows (non-negotiable)

### 8.1 Scenario Runner
- The game must support a Scenario Runner that can:
  - load a scene/area
  - inject deterministic inputs
  - trigger interactions and encounters
  - emit artifacts (trace, screenshots/frames, optional movies)
- Supported scenario actions:
  - `wait_frames`: Pause for N frames before continuing.
  - `capture`: Save a screenshot with a label.
  - `move`: Simulate directional input (left/right/up/down) for N frames.
  - `press`: Simulate a button press for an input action (e.g., "interact").

### 8.2 Deterministic artifacts
- Every milestone must add/update at least one Scenario Runner scenario.
- UI/visual changes must add/update a rendered capture scenario producing deterministic frames for diffing.

### 8.3 Guardrails
- Spec drift guardrail must exist (CI fails if gameplay changes without spec.md updates).
- Visual regression diffing is required for golden scenarios.

## 9. Repo conventions
- Source art lives under `art/` and must be reproducible (recipes + palettes).
- Runtime assets live under `game/assets/`.
- Game content and code live under `game/` (`res://game/...` in Godot).
