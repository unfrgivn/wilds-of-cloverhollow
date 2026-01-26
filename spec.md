# Wilds of Cloverhollow — spec

Last updated: 2026-01-26

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
- Dialogue branching: DialogueManager supports `show_dialogue_with_choices(prompt, choices)`.
  - choices: Array of {text, response, flag} - each option shown as a selectable button.
  - Player navigates choices with up/down, confirms with interact/accept.
  - Selected choice's flag (if set) is stored as a story flag.
  - Selected choice's response is shown as follow-up dialogue.
- BranchingDialogueNPC: NPC script with exported choice arrays for dialogue trees.

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
- ToolGiverNPC: NPC that gives a tool to the player once (e.g., blacksmith gives wrench).
  - Tracks tool_id and quest_id for quest objective completion.
  - Shows different dialogue if player already has the tool.
- BrokenFountain: Tool-gated interactable that requires a specific tool to fix.
  - Auto-starts associated quest if player lacks the tool.
  - Sets story flag and completes quest when repaired.
- ForestGate: Story-gated transition that blocks forest access until `forest_unlocked` flag is set.
  - Shows locked/unlocked dialogue based on story progression.
  - Transitions to target area when unlocked.
- EvidencePickup: Collectible evidence item for quest progression.
  - Tracks collection via story flags (evidence_{id}_collected).
  - Completes quest objectives when picked up.
- ChaosQuestChainNPC: Multi-role NPC for quest chain progression.
  - Roles: quest_giver, evidence_receiver, forest_unlocker.
  - Handles multiple quests in sequence based on story flags.
- All gated interactables show different dialogue depending on whether requirements are met.

### 3.12 Main quest chain
- chaos_investigation: Talk to townspeople about strange events (flags: chaos_investigation_done).
- chaos_gather_evidence: Collect evidence items (glowing shard, torn cloak) and bring to Elder.
- chaos_unlock_forest: Elder unlocks forest path after evidence gathered (grants lantern, sets forest_unlocked).

### 3.12 Opening cutscene
- GameIntroController (Main.tscn script) orchestrates game start sequence.
- Sequence: TitleScreen → IntroNarration → Hero Bedroom (wake up).
- TitleScreen: Game title with Start button, fade transitions.
- IntroNarration: 6-line story text crawl with typewriter effect.
  - Press interact/accept to skip typing or advance.
  - Fades to black after final line.
- Player spawns at "bed" marker in Area_HeroHouseUpper.tscn.

### 3.13 Bulletin board and quest system
- BulletinBoardInteractable: opens QuestUI when interacted.
- QuestUI (CanvasLayer): displays available quests from the bulletin board.
  - Quest list view: shows quest names, navigate with up/down, select to view details.
  - Quest details view: shows name, description, reward, objectives. Accept/Decline buttons.
  - Accepting a quest sets `quest_accepted_{quest_id}` story flag.
  - Completed quests (matching completion_flag) are hidden from the board.
  - Quests with required_flag only show if that flag is set.
- Quest data stored in `game/data/quests/quests.json`:
  - Fields: id, name, description, type, reward_gold, reward_items[], required_flag, completion_flag, objectives[].
- GameData autoload loads quest data at startup via `get_quest(id)` and `get_available_quests()`.

### 3.14 Quest manager
- QuestManager autoload tracks active and completed quests.
- `start_quest(quest_id)`: Starts a quest, initializes objective tracking, emits `quest_started`.
- `complete_objective(quest_id, index)`: Marks an objective complete, auto-completes quest if all done.
- `complete_quest(quest_id)`: Completes quest, sets completion_flag, grants rewards, emits `quest_completed`.
- `is_quest_active(quest_id)`, `is_quest_completed(quest_id)`: Query quest state.
- `get_active_quests()`: Returns array of active quest data with objective status.
- `get_save_data()`, `load_save_data(data)`: Persistence support.
- QuestLogUI (CanvasLayer): Player menu to view active and completed quests.
  - Tabs: Active/Completed toggle.
  - Quest list with selection, details panel showing objectives and rewards.
  - Objectives show checkboxes ([x] complete, [ ] incomplete).

### 3.15 Day/Night cycle
- DayNightManager autoload tracks time of day.
- 4 time phases: Morning (0), Afternoon (1), Evening (2), Night (3).
- CanvasModulate overlay applies color tinting per phase:
  - Morning: warm sunrise (1.0, 0.95, 0.9)
  - Afternoon: neutral daylight (1.0, 1.0, 1.0)
  - Evening: orange sunset (1.0, 0.85, 0.7)
  - Night: cool blue (0.6, 0.65, 0.85)
- Smooth tween transitions between phases (1 second default).
- Time advances automatically on area transitions.
- Scenario action `set_time_phase`: instantly set time for testing.

### 3.16 Weather system
- WeatherManager autoload manages weather state and effects.
- 3 weather types: Clear (0), Rain (1), Storm (2).
- Rain: CPUParticles2D system with angled raindrops.
- Storm: Heavy rain + periodic thunder flashes via ColorRect overlay.
- Thunder flash: white overlay tween (quick bright pulse).
- Scenario actions: `set_weather`, `trigger_thunder`.

### 3.17 Lamp props
- Lamp script (Sprite2D) that toggles between on/off textures.
- Lamps connect to DayNightManager.time_changed signal.
- Lamps turn on at evening and night (phases 2 and 3).
- lamp_on.png and lamp_off.png sprite variants in props/lamp/.

### 3.18 NPC schedule system
- ScheduledNPC script (CharacterBody2D) manages time-based NPC visibility.
- NPCs appear/disappear based on current time phase and area.
- Schedule data stored in `game/data/npcs/schedules.json`:
  - Each entry keyed by npc_id contains: npc_id, npc_name, locations (dict by phase), default_area, default_position.
  - Location entries specify: area (scene path), position [x, y], marker (spawn marker id).
- GameData autoload loads schedules via `get_npc_schedules()` and `get_npc_schedule(npc_id)`.
- ScheduledNPC connects to DayNightManager.time_changed signal.
- On time change, NPC shows if current scene matches scheduled area for that phase, hides otherwise.

### 3.19 Relationship/affinity system
- AffinityManager autoload tracks NPC friendship levels.
- Affinity score: 0-100 per NPC, higher is better.
- Affinity levels (thresholds): Stranger(0), Acquaintance(20), Friend(40), Good Friend(60), Best Friend(80), Soulmate(100).
- Affinity data stored in `game/data/npcs/affinity.json`:
  - npcs: array of {npc_id, npc_name, starting_affinity}.
  - affinity_events: standard modifiers (gift_liked: +10, gift_disliked: -5, etc.).
- API: `get_affinity(npc_id)`, `set_affinity(npc_id, value)`, `change_affinity(npc_id, amount)`.
- `get_npc_level(npc_id)`: returns current relationship level name.
- Signals: `affinity_changed(npc_id, old_value, new_value)`, `affinity_level_up(npc_id, old_level, new_level)`.
- Dialogue choices can modify affinity via `affinity_change` field in choice data.
- AffinityUI (CanvasLayer): displays NPC list with relationship bars and levels.
- Scenario actions: `set_affinity`, `change_affinity`, `check_affinity`.

### 3.20 Pause menu
- PauseManager autoload handles game pause state.
- Input: "pause" action (Escape key, P key) toggles pause.
- Pausing sets `get_tree().paused = true` and shows PauseMenuUI.
- PauseMenuUI (CanvasLayer): modal overlay with Resume, Items, Save, Quit options.
  - Resume: unpauses game and closes menu.
  - Items: placeholder for inventory UI (M92).
  - Save: triggers SaveManager.save_game() with confirmation.
  - Quit: unpauses and returns to Main.tscn (title screen).
- Navigation: up/down to select, accept/interact to confirm, cancel/pause to resume.
- Scenario actions: `pause_game`, `unpause_game`, `toggle_pause`, `check_pause`.

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
- `quests/quests.json`: Quest definitions with id, name, description, type, reward_gold, reward_items[], required_flag, completion_flag, objectives[].
- `npcs/schedules.json`: NPC schedule definitions with npc_id, npc_name, locations (dict by phase), default_area, default_position.
- `equipment/equipment.json`: Equipment definitions with id, name, slot (weapon/armor/accessory), attack_bonus, defense_bonus, speed_bonus, price.

GameData autoload loads and caches all data on startup. Adding new content requires only JSON + sprite assets (no code changes).

Content lint script (`tools/lint/lint-content.sh`) validates:
- JSON syntax
- Required fields per schema
- Reference integrity (skill/item IDs referenced must exist)

### 5.5 Equipment system
- PartyManager autoload tracks equipment state per party member.
- 3 equipment slots: weapon, armor, accessory.
- Equipment data stored in `game/data/equipment/equipment.json`.
- `equip_item(member_id, equip_id)`: Equips item to correct slot.
- `unequip_slot(member_id, slot)`: Removes item from slot.
- `get_stat_with_equipment(member_id, stat)`: Returns base stat + equipment bonuses.
- Equipment bonuses: attack_bonus, defense_bonus, speed_bonus.
- EquipmentUI scene allows viewing/changing equipment (stub UI).
- Scenario actions: `equip_item`, `unequip_slot`, `check_equipment`.

### 5.6 Scenario action: load_scene
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
- Library (Interior): Town library with warm wooden interior. 6 bookshelves with colorful books along walls, ladder prop for high shelves, 2 reading tables with 4 chairs, checkout desk with book stack. Librarian NPC at checkout desk with branching dialogue (4 branches) about research topics, book sections, and town history. Book lookup UI stub showing catalogue topics (placeholder for future search functionality). Library sign with welcome dialogue. Transition back to Town Center.
- Café (Exterior): Café facade (48x64) with awning in warm red/maroon stripes, outdoor seating hints at base. Located in Town Center between Library and School facades. Transition to Café Interior.
- Café (Interior): Cozy café interior with warm wooden floor. Counter with cash register, glass display case with pastries, 3 tables with chairs. Kitchen visible through doorway at back. Menu board on wall. Baker NPC behind counter with branching dialogue (4 branches) about pastries, secret family recipes, and placeholder recipe mechanic hook. Welcome sign with café greeting. Transition back to Town Center.
- Town Hall (Exterior): Official-looking facade (48x64) with stone gray columns, triangular pediment, windows, double door. Located in Town Center at bottom left. Transition to Town Hall Interior.
- Town Hall (Interior): Administrative building interior with gray-brown floor. Reception desk at center, Mayor's Office door at back right (currently closed), notice board at left with quest poster placeholders (5 colored rectangles). Waiting chairs, decorative plants, flagpole with flag. Mayor NPC (Mayor Thornwood) in formal attire with branching dialogue (5 branches) about town problems, strange creatures, quest notices, Elder's knowledge, and investigation rewards - serves as quest-giver stub. Notice board interactable showing quest postings. Transition back to Town Center.
- Pet Shop (Exterior): Facade (48x64) with animal silhouettes on sign. Located in Town Center at upper right. Transition to Pet Shop Interior.
- Pet Shop (Interior): Warm wooden interior with 3 animal cages along left wall, 2 food bins (food and treats) along right wall, accessory rack and toy rack at bottom. Counter with cash register. AudioStreamPlayer for ambient pet sounds (chirps, purrs). Interactable cages, food bins, and accessories. Pet Clerk NPC (Clover) behind counter with ShopUI selling pet treats, fancy collar, and squeaky toy. Transition back to Town Center.
- Blacksmith (Exterior): Facade (48x64) with anvil sign and forge smoke hint. Located in Town Center at lower center (180, 220). Transition to Blacksmith Interior.
- Blacksmith (Interior): Dark workshop interior with brown floor. Forge with glowing embers at left wall, anvil nearby. 2 weapon racks at right wall displaying swords and axes. Workbench in center with tools. Tool display shelves with hammers, tongs, chisels, files. Counter for shop area. All interactables with dialogue about blacksmithing craft. Blacksmith NPC (Ironhammer) behind counter with NPCDialogueTree script - 5 dialogue branches about crafting, metalwork traditions, weapons, and upgrade services (coming soon stub). Transition back to Town Center.
- Clinic (Exterior): Facade (48x64) with red cross sign. Located in Town Center at lower right (320, 220). Transition to Clinic Interior.
- Clinic (Interior): Clean white/light blue interior with tiled floor. Reception desk at center-top with welcome sign. 2 medicine cabinets on left wall with potions and supplies. Exam table in center-left. 3 hospital beds on right wall behind curtain partition. Waiting chairs at bottom-left. Decorative plant. Red cross sign above reception. All interactables with dialogue about clinic services. Doctor NPC (Dr. Willowmere) near reception with NPCDialogueTree script - 5 dialogue branches with health tips (sleep, diet, exercise) and party heal service stub. Transition back to Town Center.
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
