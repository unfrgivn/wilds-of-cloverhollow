# Wilds of Cloverhollow — Spec (Single Source of Truth)

This document is authoritative. If behavior, art, data formats, or UX changes, update `spec.md` in the same change.

## 1) Product definition

### 1.1 Audience + tone
- Audience: kids 8–12 and families
- Tone: cozy, safe, friendly, whimsical magic-realism
- Core loop: explore a small-town world, solve light puzzles, make animal friends, and engage in light JRPG combat

### 1.1.1 Inspirations (non-binding)
- Cozy exploration + light puzzles (Zelda-like structure)
- Friendly small-town life + discovery (Animal Crossing / Stardew-like vibe)
- Wholesome, humorous JRPG tone (EarthBound-like *tone*, not literal art style)

### 1.2 Narrative (high level)
- Hero: Fae (age 10)
- Hero balances school life with stopping a chaos-causing antagonist (a kid at school)
- Party members join across regions

## 2) Platform + engine

- Platform: iOS native, landscape-only (iPhone + iPad)
- Engine: Godot 4.5.x (GDScript)
- Dev hardware: macOS only
- Touch input: virtual joystick + interact button, safe-area aware
- Performance: render scale presets with CLI override

## 3) World presentation

### 3.1 Camera
- Exploration camera: fixed 3/4 overhead, no rotation
- Prefer orthographic camera for readability

### 3.2 World structure
- Discrete areas (scene-per-area)
- Transitions via SceneRouter with deterministic spawn points

### 3.3 Movement
- Free analog movement
- 8-direction facing selection (based on movement vector)

### 3.4 Encounters
- Visible overworld enemies
- Touch/collision triggers battle transition

### 3.5 Runtime state + data spine
- GameState tracks current scene, spawn id, party roster, flags, inventory (including tools), quest state, encounter id, return scene
- QuestLog autoload tracks quest progress and completion flags, backed by GameState persistence
- DataRegistry loads `.tres` defs for enemies, encounters, party members, items/tools, skills, quests, and biomes from `res://game/data/...`
- Encounter defs include `biome_id` and `battle_background_id` to resolve battle backgrounds from `game/assets/battle_backgrounds/<biome>/<id>/bg.png` (optional `fg.png`)

### 3.6 Reference resolution + world scale (initial calibration)
These numbers exist to prevent "scale drift" across assets and UI.

- **Design reference resolution (UI + composition):** 1920×1080 (landscape)
  - Used for UI mockups, battle layout positioning, and snapshot comparisons.
  - The game must still scale to iPhone/iPad safely (see safe-area notes in docs).

- **World units:** 1 Godot unit = 1 meter.

- **Exploration camera:** fixed orthographic.
  - `keep_aspect = KEEP_HEIGHT` (Hor+ behavior).
  - Starting pitch: ~-60°.

- **Pixel scale target:**
  - **Pixel density:** 24 px per meter (design kit default).
  - Humanoid height in-world: 1.7 m → ~41 px tall in exploration.
  - Recommended sprite bake sizes: 48 px overworld, 72 px battle (pixel-perfect nearest).

Notes:
- The exact orthographic `Camera3D.size` will be tuned to hit the ~54px target.
- If this calibration changes, update this section and regenerate any dependent assets.

## 4) Art direction + determinism

### 4.1 Visual stack
- Environments: pixel art tiles + props (sprite-based, grid-aligned)
- Characters/enemies: pixel art sprites in exploration and battle
- Battles: 2D pixel art battle scenes with pre-rendered backgrounds

### 4.2 Palettes
- Per-biome palette for environment accents (max 24 colors per biome scene)
- Shared palette for:
  - UI
  - skin tones
  - outline/ink colors

### 4.3 Pixel shading
- 3-step value ramp (no gradients, no dithering)
- Single key light (upper-left) baked into sprites
- 1px ink outline on character silhouettes (selective internal outlines)

### 4.4 Sprite standards (exploration + battle)

#### Exploration (overworld)
- Characters and most enemies use **8-direction** animation sets:
  - Directions: N, NE, E, SE, S, SW, W, NW.
  - Facing selection is derived from the movement vector (camera does not rotate).

#### Battle
- Battle uses a classic side-view with **2-direction** sprite sets:
  - Facing: L/R.
  - Party faces left; enemies face right.

#### Required minimum animations (v0)
- Overworld: `idle`, `walk`
- Battle: `idle`, `attack`, `hurt`

#### Overworld sprite filename convention
- Files are named `{id}_idle_<DIR>.png` and `{id}_walk_<DIR>.png` with `DIR` in `N, NE, E, SE, S, SW, W, NW`.
- Runtime animation names are `idle_<dir>` and `walk_<dir>` (lowercase `dir`).

If an entity lacks an animation, the game must fall back gracefully (e.g., reuse `idle`).

### 4.5 Town-first style lock
- Cloverhollow is the visual "truth" for the game.
- Do not expand to additional biomes until:
  - Cloverhollow palette + pixel kit settings are locked
  - at least 10 town props exist
  - at least 1 enemy family is implemented (sprites + battle)

### 4.6 Deterministic pipeline rule
All assets must be reproducible from:
- a versioned recipe (`art/recipes/...`)
- a versioned template (`art/templates/...`)
- pinned tool settings (resolution, pixel density, filter)

No manual per-asset tweaks in Godot that cannot be regenerated.

## 5) Battle UX (no cassette theming)

### 5.1 UI goals
- Readability first
- Minimal themed chrome at first (simple boxes are acceptable)
- No cassette-player motif (Cassette Beasts is a reference for clarity/framing only)
- No large, themed bottom "device" bar

### 5.2 Layout (baseline)
- Top HUD:
  - Enemy list with small portraits + HP bars + status (top-left)
  - Party list with portraits + HP/MP + status (top-right)
- Bottom:
  - Command menu box (Attack / Skills / Items / Defend / Run)
  - Context/help text box
- Baseline scene: `res://game/scenes/battle/BattleScene.tscn`

### 5.3 Party
- 4 party members max on screen (MC + 2 + pet), equal spacing

### 5.4 Battle backgrounds
- Pre-rendered PNG background per encounter/biome.
- Battle scenes load backgrounds via `EncounterDef` (`biome_id` + `battle_background_id`).
- Backgrounds are authored at 960×540 and scaled to 1920×1080 with nearest-neighbor integer scaling.
- Optional foreground overlay (fg.png) is allowed.

## 6) Initial biomes (v0)

Biomes are implemented as packs: palette + prop kit + enemy roster + battle backgrounds.

Planned scale (non-binding): 8+ biomes over the life of the project.

- Cloverhollow (main town)
- Bubblegum Bay (beach town)
- Pinecone Pass (mountain ski town)
- Enchanted Forest (gated/late-game)
- Forest near Cloverhollow (clubhouse woods)

## 7) MVP vertical slice (definition of done)

A "vertical slice" is done when a player can:
1. Start at Fae's house
2. Walk to Cloverhollow town
3. Interact with 2 NPCs + 1 sign + 1 container
4. See a visible enemy and trigger a battle
5. Win a battle and return to exploration
6. Fast-travel is stubbed (bus stop UI placeholder)

## 8) Testing + automation

### 8.1 Required
- Headless smoke boot command
- Unit/integration tests for core systems (GUT CLI)
- Spec drift guardrail script must pass in CI
- Scenario Runner that can:
  - move through an area
  - trigger an interaction
  - trigger a battle
  - write deterministic capture artifacts
- Golden path scenario: `tests/scenarios/golden_vertical_slice.json` exercises transition, interaction, encounter, and one battle turn

### 8.2 Visual regression
- Primary: deterministic video output (Movie Maker mode)
- Secondary: checkpoint screenshots (if stable)

### 8.3 No OS window control requirement
Automation must not rely on clicking/focusing a game window.
All automated playtests must be runnable via CLI and produce artifacts to disk.

## 9) Explicit non-goals (v0)
- Web export
- Switch export (possible later via porting partner, but not planned for v0)

