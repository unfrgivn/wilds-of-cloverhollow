# Product Specification — Cloverhollow (EarthBound-inspired exploration RPG)

## 1. Product goal

Build an **original** 2D exploration RPG in **Godot 4.5** that evokes the **feel** of a classic SNES-era game (readability-first town exploration, cozy “dollhouse” interiors, fast scene transitions, quirky NPC dialogue), while using **fully original** story, characters, and assets.

**Milestone 1 (this repo):** a **fully playable demo** set in the starter town **Cloverhollow**, where the player character **Fae** can:

- Walk around town (top-down / oblique)
- Enter/exit buildings with smooth scene transitions
- Talk to NPCs
- Interact with world objects (signs, bins, containers, beds, arcade machines, lockers)
- Pick up items into an inventory and use at least **one** item in the world
- Complete a short “weird stakes” micro-quest that spans multiple locations

Battles are **not required** for the demo, but the architecture should not block future battle integration.

## 2. Technical baseline

- Engine: **Godot 4.5**
- Scripting: **GDScript**
- Rendering: **2D (CanvasItem)**
- Platforms (demo): desktop (Windows/macOS/Linux)
- Input (demo): **keyboard** (controller support can be added later without redesign)

### 2.1 Presentation target (SNES-like feel without forced pixel art)

The demo should *feel* like an SNES RPG primarily through:
- constrained play-space scale and tight town layout
- fast, readable interaction loops
- clear collision and navigation lanes
- consistent camera framing
- UI that prioritizes legibility

**Art source of truth:** the user-provided concept samples in `art/reference/concepts/`.

Optional (recommended) rendering approach:
- render the world into a **low-resolution SubViewport** and scale up (for a “retro” cohesiveness even with non-pixel source art)
- keep this as a toggle (`Settings -> Retro Filter`) so the team can evaluate the look quickly

## 3. Art pipeline

### 3.1 Generation tool
Art is produced using an external image generation tool (“nano banana” via the user’s image tool). The repository should:
- store prompts and constraints
- store the chosen outputs (PNG)
- provide a repeatable import/slicing workflow (sprite sheets / atlases)

See:
- `docs/art-pipeline.md`
- `art/reference/concepts/` (style targets)

### 3.2 Style targets (from provided samples)
The current direction reads as:
- cozy watercolor / soft shading
- sticker-like outlines on props and collectibles
- “cutaway room” interiors (dollhouse / diorama)
- warm lighting, friendly shapes
- occasional “odd” motifs (hypnotic eyes, neon glow, blacklight effects)

This style is acceptable and can still support EarthBound-like gameplay pacing.

### 3.3 Asset constraints (so generated art remains usable)
- Characters/NPCs: deliver either
  - **(Preferred)** 4-direction walk cycle (idle + 2–4 step frames per direction), transparent background, consistent pivot; or
  - (POC) a single idle pose with a procedural bob animation (acceptable for the first playable)
- Interiors: deliver each room as either
  - a single background image + collision polygons + hotspots; or
  - a small tile/prop kit placed in-engine
- Props/collectibles: individual PNGs suitable for atlasing

## 4. Player experience (demo)

### 4.1 Core loop
1. Explore → see points of interest
2. Talk/check → get quirky dialogue + hints
3. Acquire an item → inventory updates
4. Use item in the world → unlock a new interaction
5. Complete micro-quest → end-of-demo stinger

### 4.2 “Weird stakes” micro-quest (demo narrative)
The demo quest should start cozy but become quietly unsettling.

**Proposed demo quest: “The Hollow Light”**
- Fae finds (or is given) a **Blacklight Lantern**
- Using it reveals **hidden sigils/notes** in Cloverhollow (at least 2 locations)
- The final reveal is in the **Arcade** (one cabinet “responds” to the hidden markings)
- The demo ends after a short, eerie interaction (no battle required)

This quest is deliberately small but seeds the larger mystery.

## 5. Gameplay requirements

### 5.1 Movement
- Top-down movement in 8 directions (or 4 directions for animation simplicity)
- Smooth acceleration/deceleration (configurable)
- Collision against static colliders
- Depth sorting (Y-sorting) so the player walks “behind” props when appropriate

### 5.2 Interactions
- A single interaction input (“Check/Talk”)
- Interactable types:
  - NPC conversation
  - Sign / plaque / bulletin board (text only)
  - Container (gives item once; then becomes “empty”)
  - Door / warp trigger
  - Bed (rest / flavor)
  - Arcade machine (flavor now; quest hook later)

### 5.3 Inventory
- Item pickup adds to inventory
- Inventory UI can be minimal in demo (list)
- At least one “usable” item for the quest:
  - Blacklight Lantern: toggled on/off; reveals hidden objects / enables checks

### 5.4 Scene transitions
- Doorways/warps between:
  - Cloverhollow exterior (town)
  - Fae’s House (bedroom + at least one other room)
  - School interior
  - Arcade interior
- Transitions include a short fade and correct spawn placement

### 5.5 World state
- NPC state and container depletion should persist across scene changes
- Quest flags persist for the duration of a session (save system is optional for demo)

## 6. Demo content scope

### 6.1 Locations (minimum)
- Cloverhollow Town (exterior)
  - town center plaza (landmark)
  - 3–5 buildings with at least 2 enterable in demo
- Fae’s House
  - Bedroom (starter room with item pickup)
  - Hall or Living room (navigation + interactions)
- School (single interior “hall” space is sufficient)
- Arcade (single interior room is sufficient)

### 6.2 NPCs (minimum)
- 3 NPCs total (across locations), each with at least 2 lines of dialogue
- 1 “weird” NPC or creature (e.g., the “Chaos Raccoon” concept) that points at the mystery

### 6.3 Items (minimum)
- 3 items total:
  - 1 starter item in Fae’s bedroom (e.g., Journal)
  - 1 quest item (Blacklight Lantern)
  - 1 currency/collectible (Candy or Gems) to demonstrate counters

## 7. System architecture requirements

The implementation must remain simple, testable, and agent-friendly.

### 7.1 Autoloads (singletons)
- `GameState`: quest flags, inventory, counters
- `SceneRouter`: transitions, spawn points, fade control
- `UIRoot`: global HUD and modal UI (dialogue, inventory)

### 7.2 Data model
- Items as `Resource` (e.g., `ItemData.tres`) with:
  - id, display_name, description
  - icon texture
  - tags (quest, consumable, key)
- Dialogue as lightweight JSON or `.tres` resources

### 7.3 Scene conventions
- Each location scene provides named spawn markers (e.g., `SpawnPoints/FrontDoor`)
- Interactables implement a shared interface (e.g., `Interactable.gd`) for consistent testing

## 8. Input mapping (keyboard demo)

Required actions:
- `move_up/down/left/right` — WASD + arrow keys
- `interact` — `Z` / `Enter` / `Space` (choose one canonical default)
- `cancel` — `X` / `Esc`
- `menu` — `C` / `Tab`

(Controller parity is out-of-scope for the first playable but the action names must not be keyboard-specific.)

## 9. Testing and automation

The repo must support:
- **Headless execution** for CI validation
- Automated tests for:
  - loading scenes without errors
  - interacting with an object yields expected state changes
  - scene transitions place the player at correct spawn
  - completing the micro-quest sets the completion flag

Preferred approach for Godot 4.5:
- **GUT (Godot Unit Test)** for unit/integration/E2E-style scene tests (CLI-friendly)
- Optional: integrate **GdUnit4** later if desired

The opencode agent should be able to:
- build/run the project from CLI
- run headless tests
- optionally drive the editor/runtime via Godot MCP

See:
- `docs/testing-strategy.md`
- `tools/testing.md`
- `tools/godot-mcp.md`

## 10. Out of scope (demo)
- Turn-based battle system
- Saving/loading to disk (optional)
- Multiple party members
- Audio/music production (use placeholders)
- Full town buildout beyond the required locations

## 11. Repository conventions

- Keep code small and composable (agent-friendly modules)
- Prefer data-driven content (Resources/JSON) over hard-coded strings
- All interactables should be testable without manual editor clicking
- Do not commit copyrighted reference screenshots
