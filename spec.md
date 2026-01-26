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
- NPCDialogueTree: NPC class that cycles through multiple dialogue branches on each interaction.

### 3.6 Area transitions
- SceneRouter autoload manages scene changes and player spawn placement.
- Areas contain SpawnMarker nodes (string-based IDs like "from_forest", "default").
- AreaTransition zones (Area2D) trigger scene changes when the player enters.
- Transitions specify target area path and target spawn marker ID.
- Player is repositioned to the spawn marker after area load.

### 3.7 Battle entry
- BattleManager autoload handles battle transitions and state.
- OverworldEnemy (Area2D) detects player collision and calls `BattleManager.start_battle(enemy_data)`.
- Enemy data includes `enemy_id` and `enemy_name` for battle setup.
- On collision, the enemy is consumed (queue_free) and battle scene loads.
- After battle ends, player returns to the overworld via SceneRouter.

### 3.8 Touch controls (iOS)
- TouchControlsManager autoload spawns touch UI on mobile platforms.
- Virtual joystick (left side): circular touch area that injects movement input.
- Interact button (right side): touch button that triggers the "interact" action.
- Safe margins (20px sides, 10px top/bottom) ensure UI avoids iPhone notches/home indicator.
- Controls are hidden during battles and menus.

### 3.9 Save/Load system
- SaveManager autoload handles save/load operations.
- Save file stored in `user://saves/save_slot_0.json` (iOS-compatible).
- Save data includes: version, timestamp, current_area, player_position, inventory, story_flags.
- InventoryManager autoload tracks tools and items, persisted via SaveManager.
- Version field enables future save file migrations.

### 3.10 Inventory and tools
- InventoryManager autoload tracks:
  - Tools: lantern, journal, lasso, flute (acquired once, not consumable).
  - Items: consumables with quantity (potion, ether, etc.).
  - Story flags: named progression markers (e.g., "talked_to_teacher").
- Tool checks: `has_tool(id)`, `acquire_tool(id)`.
- Item checks: `has_item(id, count)`, `add_item(id, count)`, `remove_item(id, count)`.
- Story flags: `has_story_flag(flag)`, `set_story_flag(flag, value)`, `get_story_flag(flag)`.

### 3.11 Gated interactions
- ToolGatedInteractable: requires a specific tool to proceed (e.g., lantern for dark areas).
- StoryGatedInteractable: requires a story flag (e.g., "talked_to_teacher" for library access).
- ItemPickup: collectible that grants tools or items when interacted.
- All gated interactables show different dialogue depending on whether requirements are met.

## 4. Party and characters
- Party size: 4 total (main character + 2 additional + pet).
- Overworld: party followers are allowed; equal size and consistent spacing.

### 4.1 Pet companion
- PetCompanion: CharacterBody2D that follows the player at consistent spacing (~32px).
- Follow behavior: moves towards player when distance exceeds threshold.
- Sprites: idle (4 directions), walk cycle (4 directions x 2 frames).
- Random idle animations: sit, scratch, yawn - triggered after ~5 seconds of standing still.
- Pet starts in Hero House Interior, follows player between rooms.

## 5. Battle system

### 5.1 Battle format (locked)
- Classic turn-based JRPG battle screen.
- Pre-rendered **pixel** battle backgrounds (static image to start).
- Battles must be playable early with placeholder art.

### 5.2 Battle UI (locked preferences)
- HUD framing: enemy + party status at the top (HP/MP/status readability).
- No cassette theming.
- No large themed "device bar".
- Boxes are acceptable for v0, but the UI must remain readable at iPhone landscape scale.

### 5.3 Battle loop (v0)
- Turn order determined by combatant speed (highest first).
- Each combatant has: display_name, max_hp, current_hp, max_mp, current_mp, attack, defense, speed.
- Player turn: command menu with Attack, Skill (placeholder), Item (placeholder), Defend, Run.
- Attack: deals damage = attacker.attack - target.defense (minimum 1).
- Defend: doubles effective defense until next turn.
- Run: ends battle with "flee" result.
- Enemy AI: attacks first alive party member.
- Victory: all enemies defeated. Defeat: all party defeated.
- BattleState class manages turn flow and win/loss conditions.
- Combatant class (Resource) represents party members and enemies.
- Party and enemy stats loaded from GameData autoload (data-driven).

### 5.4 Data schemas (locked)
All game content is data-driven via JSON files under `game/data/`:
- `enemies/enemies.json`: Enemy definitions with id, name, max_hp, max_mp, attack, defense, speed, skills[], drops[].
- `skills/skills.json`: Skill definitions with id, name, type, mp_cost, power, target, element.
- `items/items.json`: Item definitions with id, name, type, effect, power, target, price.
- `party/party.json`: Party member definitions with id, name, role, max_hp, max_mp, attack, defense, speed, skills[].
- `biomes/<biome>.json`: Biome metadata (id, name, palette_path).
- `encounters/<biome>.json`: Encounter tables for each biome.

GameData autoload loads and caches all data on startup. Adding new content requires only JSON + sprite assets (no code changes).

Content lint script (`tools/lint/lint-content.sh`) validates:
- JSON syntax
- Required fields per schema
- Reference integrity (skill/item IDs referenced must exist)

### 5.5 Scenario action: load_scene
- `load_scene`: Load a scene directly by path (for testing battles without overworld trigger).

## 6. Art direction and determinism

### 6.1 Concept art reference
- `docs/art/concept-reference.md` is the aesthetic guide for all asset creation.
- Asset creators must reference this document before creating new content.
- Concept art source files live in `docs/art/concepts/`.

### 6.2 Key rule
**All art must be normalizable and consistent.** AI outputs are treated as raw inputs; the pipeline enforces style.

### 6.3 Palettes (locked)
- Each biome has a palette.
- There is a shared global palette for UI + skin tones + outline/ink.
- All tiles/sprites must quantize to: biome palette ∪ global palette.

### 6.4 Pixel style constraints (locked)
- Single pixel density (no mixed-scale sprites).
- No resampling; nearest-neighbor only.
- Avoid noisy textures; prefer clean shapes and limited shading bands per material.

## 7. World structure (content)
- Discrete areas/scenes are allowed (and preferred for simplicity).
- Biomes/towns planned: Cloverhollow (main town), Bubblegum Bay, Pinecone Pass, Enchanted Forest, Forest/Clubhouse Woods, and more (8+ total).

### 7.1 Cloverhollow town (v0 blockout)
- Town Center (Town Square): central hub connecting to other areas; fountain centerpiece, 4 trees, benches, lamps, sign, enemy spawn. Building facades: General Store, School, Arcade, Library (48x64 sprites). 3 NPC spawn markers for future NPCs. Transitions to Hero House (west), School (east-top), Arcade (east-bottom), Bubblegum Bay (south), General Store (near shop facade).
- General Store: Interior shop where player buys items. Counter with cash register, 4 shelves with potions/supplies, display crates with produce. Shopkeeper NPC behind counter with ShopUI buy interface (potion, ether, antidote). Door transition back to Town Center. Welcome sign with shop dialogue.
- Hero House: Fae's home exterior with 2-story cottage blockout (roof, chimney, porch, door, 4 windows), trees, fence, mailbox, flowers. Door transition zone to interior (placeholder interior scene exists).
- Hero House Interior (Ground Floor): Kitchen area (stove, sink, table with chairs), living room area (couch, rug, bookshelf), door transition back to exterior, stairs transition to upper floor. Mom NPC in kitchen with branching dialogue (3 branches).
- Hero House Interior (Upper Floor): Bedroom area (bed, desk with lamp, closet), bathroom area (tub, toilet, sink), interactable mirror with placeholder dialogue, stairs transition back to ground floor.
- School: Cloverhollow Elementary exterior with school building (double doors), playground area (swing set, slide), flagpole, bike rack, benches, sign. Teacher NPC with story-gated library access. Transition to Town Center.
- School Hall (Interior): Main hallway with lockers (6 rows), bulletin board, trophy case, principal's office door, 4 classroom doors (Rooms 101-104). Transitions to/from school exterior.
- School Classroom (Interior): Standard classroom with teacher's desk, chalkboard, clock, 2 windows, 15 student desks in 3 rows. Teacher NPC at desk with branching dialogue (3 branches) about lessons/homework. 3 classmate NPCs (unique sprites, 2 dialogue lines each) seated at desks. Transitions to/from school hall.
- Arcade: Pixel Palace Arcade exterior with facade sprite (48x64), neon-style "ARCADE" sign, arcade machines visible through window, game/highscore posters, flyers, lamps. Transition to Town Center. Door transition to interior.
- Arcade Interior: Neon-lit interior with dark purple/blue floor and magenta/cyan accent stripes. 8 arcade cabinet props (5 variants: original, racing, fighter, puzzle, shooter), counter with snacks display, prize redemption corner with prize shelf, stuffed bunny, and ticket counter. Arcade Owner NPC (Buzz) behind counter with branching dialogue about high scores, prizes, and games. ArcadeCabinetInteractable script launches minigame scenes when configured (or shows placeholder dialogue if no minigame set). Catch-A-Star minigame: simple "catch falling items" reflex game with 30-second timer, score tracking, catcher controlled by left/right input. Returns to Arcade Interior on completion. Transitions to/from Arcade exterior.
- Town Park: Green space with grass background, walking paths, 9 trees scattered around perimeter, pond with bridge, 4 flower beds with flowers, 2 picnic tables, 2 benches, 2 trash cans, park sign. Elder NPC sitting on bench with branching dialogue (4 branches) about town history, mysterious forest, and quest hook about strange happenings. Transitions to Town Center (west) and Forest Entrance (east via path to forest edge).
- Library (Interior): Town library with warm wooden interior. 6 bookshelves with colorful books along walls, ladder prop for high shelves, 2 reading tables with 4 chairs, checkout desk with book stack. Library sign with welcome dialogue. Transition back to Town Center.
- Props: bench, sign, lamp, tree (16x32), fence, flowers (all 16x16 except tree).
- Enemy: Grumpy Squirrel (non-scary, green, visible in overworld).
- Battle background: cloverhollow_meadow.png (512x288).

### 7.2 Bubblegum Bay (v0 blockout)
- Wilderness biome: beach/bay area with pastel pink/purple palette.
- Single area scene with sand, water, bubble props.
- Connected to Town Center via area transition.
- Enemy: Pink Slime (reskinned slime).
- Battle background: bubblegum_bay.png (512x288).

### 7.3 Biome factory workflow
- `tools/content/new-biome.sh <id> [name] [type]`: Scaffolds new biome with:
  - Palette stub in `art/palettes/<id>.palette.json`
  - Biome data in `game/data/biomes/<id>.json`
  - Encounter table in `game/data/encounters/<id>.json`
  - Scenario stub in `tests/scenarios/<id>_exploration_smoke.json`
  - Checklist in `docs/biomes/<id>.md`
- `tools/content/check-biome.sh <id>`: Validates biome completeness (palette, tileset, scene, scenario, docs).

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
  - `save_game`: Save current game state (position, inventory, story flags).
  - `load_game`: Load game state from save file.
  - `acquire_tool`: Give a tool to the player (tool_id).
  - `set_story_flag`: Set a story flag (flag, value).
  - `check_tool`: Log whether player has a tool (tool_id).
  - `check_story_flag`: Log whether a story flag is set (flag).

### 8.2 Deterministic artifacts
- Every milestone must add/update at least one Scenario Runner scenario.
- UI/visual changes must add/update a rendered capture scenario producing deterministic frames for diffing.

### 8.3 Guardrails
- Spec drift guardrail (`tools/spec/check_spec_drift.py`):
  - CI/local check fails if `game/**`, `tools/**`, `.opencode/**`, or `project.godot` changes without `spec.md` update.
  - Override via commit message tags: `[spec-ok]` or `[refactor]`.
  - Override via environment: `ALLOW_SPEC_DRIFT=1`.
  - Full documentation: `docs/working-sessions/spec-drift-guardrail.md`.
- Visual regression diffing is required for golden scenarios.

## 9. Repo conventions
- Source art lives under `art/` and must be reproducible (recipes + palettes).
- Runtime assets live under `game/assets/`.
- Game content and code live under `game/` (`res://game/...` in Godot).
