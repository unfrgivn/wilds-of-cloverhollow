# Detailed plan: from scaffold → fully playable iOS JRPG

This plan assumes:
- you develop on macOS only,
- iOS native is the only target for v0,
- agents cannot depend on OS-level window control,
- and art must be deterministic (template + recipes, not manual edits).

The goal is to ship a **vertical slice** first, then grow content packs (biomes) predictably.

---

## Guiding principles (non-negotiable)

1) **Spec-first**: `spec.md` is authoritative. Any behavior change requires a `spec.md` update in the same change.
2) **No manual art drift**: runtime assets are generated from `art/recipes/` + `art/templates/` and validated.
3) **Automation first**: every milestone adds or updates at least one Scenario Runner scenario.
4) **Town-first**: Cloverhollow is the style lock anchor; do not expand biomes until Cloverhollow is stable.

---

## Toolchain prerequisites

Minimum:
- Godot 4.5.x (stable)
- Python 3.11+ (scripts)
- Blender (sprite/background bakes)

Later (for device builds):
- Xcode (iOS export)

---

## Milestone 0 — Repo boot + CI sanity

**Owner:** QA Automation + Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
The project boots reliably (macOS) and has working headless entrypoints.

### Tasks
1. Confirm `project.godot` boots and loads `res://game/bootstrap/Main.tscn`.
2. Implement minimal `game/bootstrap/boot.gd` so it:
   - parses CLI user args after `--` (for later)
   - loads a test scene (temporary)
3. Ensure `tools/ci/run-smoke.sh`:
   - runs Godot headless
   - fails on errors
4. Set up GUT test framework (if not already) and make `tools/ci/run-tests.sh` run it.

### Acceptance criteria
- `./tools/ci/run-smoke.sh` passes on macOS.
- `./tools/ci/run-tests.sh` passes on macOS.

### Files (expected)
- `game/bootstrap/boot.gd`
- `game/bootstrap/Main.tscn`
- `tools/ci/run-smoke.sh`
- `tools/ci/run-tests.sh`

---

## Milestone 1 — Exploration core: movement + camera + 8-direction facing

**Owner:** Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
Player can move with free analog input in a 3D scene, with a fixed 3/4 overhead camera and stable 8-direction sprite facing.

### Tasks
1. Create `game/scenes/actors/Player.tscn`:
   - `CharacterBody3D` root
   - `CollisionShape3D`
   - `AnimatedSprite3D` visual
2. Implement `game/scripts/exploration/player.gd`:
   - analog input → normalized movement
   - diagonal normalization (no faster diagonals)
   - 8-direction selection from movement vector
3. Create `game/scenes/camera/FollowCameraRig.tscn`:
   - orthographic `Camera3D`
   - fixed pitch ~-60°, no yaw rotation
   - follow player in X/Z
4. Create a test room scene `game/scenes/tests/TestRoom_Movement.tscn` with collisions.
5. Add a Scenario Runner scenario `tests/scenarios/movement_smoke.json`:
   - load test room
   - move in a square
   - capture a checkpoint

### Acceptance criteria
- Player moves smoothly, no wall clipping.
- Facing changes correctly across all 8 directions.
- Camera does not jitter.
- `./tools/ci/run-scenario.sh movement_smoke` produces artifacts.

---

## Milestone 2 — Interactions + dialogue

**Owner:** UI Systems + Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
Player can interact with NPCs and objects, producing dialogue text and basic item pickup.

### Tasks
1. Define an `Interactable` interface (group tag + script) and `InteractionDetector` on Player.
2. Implement `DialogueBox.tscn` + `dialogue_box.gd`:
   - typewriter text
   - tap to advance
   - optional speaker name
3. Add `Sign` and `Container` interactables:
   - sign: displays text
   - container: gives a stub item and sets a flag in GameState
4. Add Scenario `interaction_smoke.json`:
   - walk to sign, interact, capture
   - walk to container, interact, capture

### Acceptance criteria
- All interactions work with keyboard/mouse on macOS and are touch-friendly by design.
- GameState receives a flag or item stub.
- Scenario produces deterministic captures.

---

## Milestone 3 — SceneRouter + deterministic transitions

**Owner:** Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
Discrete areas load deterministically with spawn markers and transitions.

### Tasks
1. Implement `SceneRouter.gd`:
   - `goto_scene(scene_path, spawn_marker_id)`
   - fade-out → load → position → fade-in
2. Define spawn markers via `Marker3D` with stable IDs.
3. Implement `Door` interactable that routes scenes.
4. Add scenario `transition_smoke.json`:
   - start in one scene
   - go through a door
   - confirm spawn marker
   - capture

### Acceptance criteria
- Door transitions always spawn at correct marker.
- No input loss or stuck state.
- Scenario produces deterministic output.

---

## Milestone 4 — Visible enemies + encounter trigger

**Owner:** World Scene Builder + Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
Enemies are visible in exploration and trigger battle on collision/interaction.

### Tasks
1. Create `EnemyActor.tscn`:
   - simple patrol/wander
   - trigger collider
2. Implement `EncounterManager`:
   - transition from exploration → battle
   - pass encounter data (enemy ids, background id)
3. Add scenario `encounter_trigger.json`:
   - move to visible enemy
   - trigger battle
   - capture battle start

### Acceptance criteria
- Touching the enemy triggers battle.
- After battle resolves, player returns to exploration.

---

## Milestone 5 — Battle system v0 (classic turn-based)

**Owner:** Battle Systems + UI Systems
**Status:** ✅ Completed (2026-01-19)

### Objective
Turn-based battle loop with 4 party members and a top HUD (no cassette theming).

### Tasks
1. Implement `BattleScene.tscn` (2D root):
   - background sprite (pre-rendered placeholder)
   - enemy and party battler sprites
   - top HUD: enemy list left, party list right (portraits + HP/MP)
   - bottom: command menu + info box
2. Implement core battle flow:
   - start state → player command selection → resolve → enemy AI → loop
   - win/lose
3. Integrate with Scenario Runner:
   - auto-select Attack for first party member
   - run one full turn
   - capture

### Acceptance criteria
- A battle can be completed.
- UI is readable at the 1920×1080 reference and scales.
- No cassette motifs.

---

## Milestone 6 — Data spine (Resources + JSON)

**Owner:** Product Architect + Battle Systems
**Status:** ✅ Completed (2026-01-19)

### Objective
New content (enemies, skills, items) can be added without code changes.

### Tasks
1. Define `Resource` schemas:
   - `EnemyDef`, `PartyMemberDef`, `SkillDef`, `ItemDef`, `EncounterDef`, `BiomeDef`
2. Add loaders and stable IDs.
3. Update battle to read from defs.

### Acceptance criteria
- Add a new enemy via data only.

---

## Milestone 7 — Pre-rendered battle backgrounds (production path)

**Owner:** Art Pipeline + Battle Systems
**Status:** ✅ Completed (2026-01-19)

### Objective

Battle backgrounds are baked deterministically and referenced by encounter data.

### Tasks
1. Standardize background outputs:
   - `game/assets/battle_backgrounds/<biome>/<id>/bg.png`
   - optional `fg.png`
2. Implement `BattleBackgroundLoader`:
   - loads bg + optional fg
3. Provide first Cloverhollow background stub.

### Acceptance criteria
- Battle uses correct background from encounter data.

---

## Milestone 8 — Scenario Runner + deterministic video capture

**Owner:** QA Automation
**Status:** ✅ Completed (2026-01-19)

### Objective
Agents can run deterministic playtests without controlling a live window.

### Tasks
1. Implement Scenario Runner as an Autoload that:
   - reads `--scenario <id>`
   - executes actions with fixed frame stepping
2. Add `tools/ci/run-scenario.sh` that:
   - writes outputs under `./captures/<scenario>/<timestamp>/`
3. Add a “golden path” scenario for the vertical slice:
   - start at Fae’s house
   - exit to town
   - interact with NPC
   - trigger visible enemy battle
   - win

### Acceptance criteria
- Scenario runs unattended and produces artifacts.
- Video capture is the primary regression signal.

---

## Milestone 9 — Art pipeline: beginner-friendly, deterministic

**Owner:** Art Pipeline
**Status:** ✅ Completed (2026-01-19)

### Objective
You (without graphics experience) can generate:
- a new NPC sprite set,
- a new enemy sprite set,
- a new battle background,
and import them into Godot with no manual editor tweaking.

### Tasks
1. Create Blender templates:
   - character rig template
   - battle background diorama template
2. Implement “one command” scripts:
   - bake character sprite sets (8-dir overworld + L/R battle)
   - bake battle backgrounds
3. Implement palette quantization + validation.
4. Document workflows in `docs/art/no-artist-workflows.md`.

### Acceptance criteria
- A new asset can be reproduced from `art/recipes/...`.

---

## Milestone 10 — iOS packaging + touch polish

**Owner:** UI Systems + QA Automation
**Status:** ✅ Completed (2026-01-19)

### Objective
Game is comfortable on iPhone/iPad in landscape with safe-area aware touch controls.

### Tasks
1. Implement `TouchControls.tscn`:
   - virtual joystick
   - action button
2. Safe-area placement
3. Performance toggles (render scale)
4. iOS export documentation + on-device smoke checklist

### Acceptance criteria
- Vertical slice runs on a real iPhone/iPad.

---

## Milestone 11 — Core JRPG systems (inventory, tools, quests)

**Owner:** Godot Gameplay Engineer + Product Architect
**Status:** ✅ Completed (2026-01-19)

### Objective
Move from “slice” to “game” by implementing the minimum systems needed to support:
- tool-gated exploration (lantern/blacklight, lasso, flute, journal),
- simple quests and flags,
- inventory and consumables,
- and party progression.

### Tasks
1. Inventory system:
   - Item definitions (`ItemDef`) and quantities
   - Add/remove items, simple UI list
2. Tool system:
   - Tool items are inventory-backed but activate world interactions
   - Tool-gated interactables (e.g., hidden note reveals with lantern)
3. Quest/flag system:
   - Quest definition format
   - Objective state (flags + counters)
   - Quest reward hooks (items/party)
4. Party system:
   - Party roster (up to 4)
   - Join/leave support (story-driven)
5. Save/load:
   - save slot
   - serialize inventory, quest flags, position, biome

### Acceptance criteria
- A tool-gated interaction exists in Cloverhollow (e.g., lantern reveals a hidden note).
- A simple quest can be completed via data definitions.

---

## Milestone 12 — Biome pack expansion process (repeatable content pipeline)

**Owner:** Product Architect + Art Pipeline + World Scene Builder

### Objective
Add new biomes (Bubblegum Bay, Pinecone Pass, etc.) using a repeatable pack process without destabilizing systems.

### Tasks
1. Implement `BiomeDef` loader and registry.
2. Create per-biome folders using the biome pack skill:
   - docs, palettes, ramps, recipes, starter scenes
3. Define a minimum per-biome “ship checklist” (see biome workshop doc).
4. Add one additional biome end-to-end (Bubblegum Bay) as the template example.
5. Add at least one scenario per biome for regression.

### Acceptance criteria
- Bubblegum Bay is playable end-to-end (enter biome, interact, one encounter, battle, return).
- Adding Pinecone Pass is mostly copy/paste + new content recipes.

---

## Milestone 13 — Polish pass (visual, UX, performance)

**Owner:** UI Systems + Art Pipeline + QA Automation

### Objective
Make the game feel production-ready: readable UI on iPhone, stable performance, consistent art.

### Tasks
1. UI pass:
   - improve battle command flow
   - add targeting UI
   - add status effects clarity
2. Animation/VFX pass:
   - add hit flashes, simple effects (palette-safe)
3. Performance:
   - render scale option
   - reduce overdraw
   - iOS profiling checklist
4. Visual regression:
   - establish golden capture baselines and a diff workflow

### Acceptance criteria
- Vertical slice runs smoothly on target devices and looks consistent across scenes.

---

## Milestone 14 — Cloverhollow battle background bake

**Owner:** Art Pipeline
**Status:** ✅ Completed (2026-01-19)

### Objective
Bake a deterministic Cloverhollow battle background and register it for encounters.

### Tasks
1. Create an art recipe + template for the Cloverhollow battle background.
2. Bake a background to `game/assets/battle_backgrounds/cloverhollow/meadow_stub/bg.png` (optional `fg.png`).
3. Validate output via scenario capture (no fallback texture).

### Acceptance criteria
- Encounter uses baked Cloverhollow background without fallback.
- Outputs are reproducible from `art/recipes/...` and `art/templates/...`.

### Notes
- Requires art direction input on Cloverhollow scene composition and palette alignment.

---

## Milestone 15 — Cloverhollow art lock + prop kit

**Owner:** Art Pipeline + Product Architect
**Status:** ✅ Completed (2026-01-19)

### Objective
Lock the Cloverhollow look and ship a minimal prop kit plus one enemy family.

### Tasks
1. Finalize Cloverhollow palette + ramp JSON.
2. Produce 10 town props (low-poly) via `art/recipes/...` and `art/templates/...`.
3. Create one enemy family base model and bake sprites (overworld + battle).

### Acceptance criteria
- Palette/ramp are committed under `art/palettes/` and referenced in docs.
- 10 props exist as deterministic recipes and runtime assets under `game/assets/props/`.
- Enemy family has baked sprites under `game/assets/sprites/enemies/<family>/...`.

### Notes
- Needs final art direction call on Cloverhollow prop list.

---

## Milestone 16 — Cloverhollow town exterior (playable)

**Owner:** World Scene Builder + Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
Build a real town exterior with NPCs, interactions, and navigation.

### Tasks
1. Create `Area_Cloverhollow_Town.tscn` with navmesh, collisions, and spawn markers.
2. Place at least 2 NPCs, 1 sign, 1 container, and a bus stop placeholder.
3. Wire SceneRouter transitions to Fae house and to battle encounters.

### Acceptance criteria
- Town is fully walkable with interactables and visible enemy encounter.
- Scenario Runner can traverse town and hit all required interactions.

---

## Milestone 17 — Fae house interior + routing

**Owner:** World Scene Builder + Godot Gameplay Engineer
**Status:** ✅ Completed (2026-01-19)

### Objective
Ship Fae house interior and wire transitions to/from town.

### Tasks
1. Build `Area_Cloverhollow_FaeHouse.tscn` with props and collisions.
2. Add door interactables and spawn markers for enter/exit.
3. Update SceneRouter entries for house/town links.

### Acceptance criteria
- Player can start inside Fae house and walk to town.
- Scenario Runner captures the transition deterministically.

---

## Milestone 18 — Cloverhollow sprites + battle backgrounds

**Owner:** Art Pipeline + Battle Systems

### Objective
Replace placeholders with baked sprites and battle background art.

### Tasks
1. Bake Fae + NPC sprite sets (8-dir overworld, 2-dir battle).
2. Bake at least one Cloverhollow battle background (bg + optional fg).
3. Wire EncounterDefs to the baked background ids.

### Acceptance criteria
- Overworld uses sprites (not capsules) for Fae/NPCs/enemy.
- Battles use baked Cloverhollow background with no fallback.

---

## Milestone 19 — Playable town demo + visual baseline

**Owner:** QA Automation + Product Architect

### Objective
Deliver a playable town demo with deterministic captures.

### Tasks
1. Add golden scenario that starts at Fae house, reaches town, interacts with 2 NPCs + sign + container, triggers battle, and returns.
2. Run rendered capture and update visual baselines.

### Acceptance criteria
- Golden scenario passes headlessly and with rendered capture.
- Visual baseline artifacts are stored under `captures/`.

---

## Milestone 20 — Character sprite pipeline v1 (Fae + NPCs)

**Owner:** Art Pipeline + UI Systems

### Objective
Ship deterministic character sprite outputs for Fae and a small NPC set using the final palette/ramp.

### Tasks
1. Finalize the Blender rig/template for character sprite baking (overworld idle/walk).
2. Bake Fae + at least 2 town NPCs to `game/assets/sprites/characters/<id>/`.
3. Update validation to enforce naming and frame counts for character outputs.
4. Add scenario `character_sprite_smoke.json` that captures Fae + NPCs in town.

### Acceptance criteria
- Fae and NPCs use baked sprites for overworld idle/walk in Cloverhollow.
- Sprite outputs are deterministic and palette-compliant.
- Scenario produces deterministic captures.

---

## Milestone 21 — Battle sprite suite (attack/hurt)

**Owner:** Art Pipeline + Battle Systems

### Objective
Expand battle sprites beyond idle to include attack/hurt for Fae and a Cloverhollow enemy family.

### Tasks
1. Add battle animation clips (attack/hurt) to character and enemy rig templates.
2. Bake battle sprite frames for Fae and the Cloverhollow enemy family.
3. Wire battle state to play attack/hurt animations.
4. Add scenario `battle_animation_smoke.json` capturing a full attack/hurt sequence.

### Acceptance criteria
- Battle sprites include attack/hurt frames and follow naming conventions.
- Battle animations trigger correctly in the turn loop.
- Scenario produces deterministic captures.

---

## Milestone 22 — Cloverhollow building facade pipeline

**Owner:** Art Pipeline + World Scene Builder

### Objective
Replace placeholder building meshes with deterministic, style-locked facades.

### Tasks
1. Define a modular facade template (walls, roofs, windows) with palette/ramp constraints.
2. Create facade recipes for School, Arcade, Library, Cafe, Clinic.
3. Bake and import facades under `game/assets/buildings/`.
4. Replace placeholder building meshes in `Area_Cloverhollow_Town.tscn` and update collisions.

### Acceptance criteria
- Town facades match Cloverhollow style lock and palette/ramp requirements.
- Building collisions align with navmesh and interactables.

---

## Milestone 23 — Cloverhollow decor kit polish

**Owner:** Art Pipeline + World Scene Builder

### Objective
Finalize decor props (fences, lamps, benches, foliage) for a cohesive town look.

### Tasks
1. Expand decor recipes under `art/recipes/props/cloverhollow/` with final-quality props.
2. Bake and validate decor assets for palette compliance and budgets.
3. Replace remaining placeholder decor in the town scene.
4. Add scenario `town_decor_smoke.json` to capture updated decor density.

### Acceptance criteria
- Decor props are deterministic and palette-compliant.
- Town scene uses final decor assets without placeholder meshes.

---

## Milestone 24 — Town art pass + visual baseline

**Owner:** Product Architect + Art Pipeline + QA Automation

### Objective
Polish Cloverhollow to style-lock quality and refresh visual baselines.

### Tasks
1. Audit Cloverhollow scenes for palette/ramp compliance and scale consistency.
2. Replace any remaining placeholder meshes or unbaked assets.
3. Run rendered capture scenarios and update visual baselines.

### Acceptance criteria
- Cloverhollow exterior + Fae house are style-locked.
- Visual baselines are updated under `captures/`.

---

## Milestone 25 — Art pipeline hardening + CI checks

**Owner:** Art Pipeline + QA Automation

### Objective
Harden validation and CI guardrails to prevent art drift.

### Tasks
1. Add `tools/ci/run-asset-check.sh` to validate recipes vs runtime assets.
2. Extend `tools/python/validate_assets.py` for palette compliance and naming.
3. Add CI coverage for asset validation failures.

### Acceptance criteria
- CI fails when assets lack recipes or violate palette/naming rules.
- Asset checks are deterministic and reproducible.
