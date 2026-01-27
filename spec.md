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
- Multiple save slots: 3 slots (0, 1, 2) stored in `user://saves/save_slot_N.json`.
- Save data includes: version, timestamp, current_area, player_position, inventory, story_flags.
- InventoryManager autoload tracks tools and items, persisted via SaveManager.
- Version field enables future save file migrations.
- Slot preview: `get_slot_preview(slot)` returns area_name, timestamp_formatted, empty status.
- SaveSlotUI (CanvasLayer): slot selection screen with preview info.
  - Shows all 3 slots with area name and save time.
  - Supports save, load, and delete operations.
  - Tab key deletes selected slot, Cancel closes UI.
- Scenario actions: `save_game`, `load_game`, `delete_save`, `check_save_slots`, `has_save` (all support slot parameter).
- Cloud sync hooks (stubs for future implementation):
  - `cloud_upload(slot)`, `cloud_download(slot)`: Upload/download save data.
  - `get_save_data_json(slot)`, `import_save_data_json(slot, json)`: Portable JSON serialization.
  - Signals: `cloud_sync_started`, `cloud_sync_completed`, `cloud_conflict_detected`.
- Save format documented in `docs/save-format.md`.

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
- find_clubhouse: Classmate hints at secret clubhouse, navigate forest to discover it (flags: clubhouse_found).
- villain_reveal: Player encounters the Chaos Lord in Dark Hollow, triggering confrontation cutscene (flags: villain_revealed).
  - VillainEncounter script triggers cutscene on player collision.
  - Chaos Lord sprite: game/assets/sprites/characters/villain/chaos_lord.png.
  - Cutscene: villain taunts player and escapes deeper into forest.
- rally_town: After villain reveal, player rallies townspeople for support (flags: ally_elder_rallied, ally_teacher_rallied, ally_blacksmith_rallied, party_formed).
  - AllyNPC script handles rally dialogue and item gifts.
  - Key allies: Elder (supplies), Teacher (knowledge), Blacksmith (equipment).

### 3.13 Opening cutscene
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

### 3.21 Inventory UI
- InventoryUI (CanvasLayer): grid-based item management screen.
- Opens from pause menu Items option.
- Displays owned items from InventoryManager with count.
- Details panel shows: item name, description, type/effect.
- Actions: Use (consumables only), Discard, Cancel.
- Navigation: arrow keys for grid, accept to open actions, cancel to close.
- Scenario actions: `add_inventory_item`, `remove_inventory_item`, `check_inventory`, `open_inventory`, `close_inventory`.

### 3.22 Party status UI
- PartyStatusUI (CanvasLayer): party member stats screen.
- Opens from pause menu Party option.
- Member list on left side, details panel on right.
- HP/MP progress bars showing current/max values.
- Stats display: ATK, DEF, SPD (including equipment bonuses).
- Equipment slots: weapon, armor, accessory.
- Navigation: up/down to select member, cancel to close.
- Scenario actions: `open_party_status`, `close_party_status`, `check_party_member`.

### 3.23 Quest log UI
- QuestLogUI (CanvasLayer): quest tracking interface.
- Opens from pause menu Quests option (future) or via scenario action.
- Tabs: Active and Completed quests.
- Active tab shows quests from QuestManager.get_active_quests() with objective status.
- Completed tab shows quests from QuestManager.get_completed_quest_ids().
- Quest list on left, details panel on right.
- Details panel: quest name, description, objectives with checkboxes, rewards.
- Navigation: up/down to select quest, left/right to switch tabs, cancel to close.
- Scenario actions: `open_quest_log`, `close_quest_log`.

### 3.24 Map screen UI
- MapScreenUI (CanvasLayer): town map display.
- Opens from pause menu Map option (future) or via scenario action.
- Cloverhollow map image with building representations.
- Current location marker (red) positioned based on current area.
- Building labels showing location names.
- Location text showing current area name.
- Navigation: cancel/pause to close.
- Scenario actions: `open_map`, `close_map`.

### 3.25 Settings UI
- SettingsManager autoload handles settings persistence.
- Settings stored in `user://settings.json`.
- SettingsUI (CanvasLayer): game options menu.
- Opens from pause menu Settings option (future) or via scenario action.
- Music volume slider (0-100%).
- SFX volume slider (0-100%).
- Touch control size option (Small/Medium/Large).
- Text size option (Small/Medium/Large) for accessibility.
- Credits button (shows game credits dialogue).
- Back button closes settings and saves.
- Navigation: cancel/pause to close.
- Scenario actions: `open_settings`, `close_settings`, `set_music_volume`, `set_sfx_volume`.

### 3.26 Music system
- MusicManager autoload handles background music playback.
- Area-based music: AREA_MUSIC dictionary maps area names to track IDs.
- MUSIC_PATHS dictionary maps track IDs to `.ogg` file paths under `game/assets/audio/music/`.
- `play_music(track_id)`: Plays a specific track with optional crossfade.
- `play_area_music(area_name)`: Plays music appropriate for the given area.
- `play_battle_music()`: Plays battle theme, stores previous track for resume.
- `play_victory_music()`: Plays victory fanfare.
- `stop_music()`: Stops current music.
- `resume_previous_music()`: Resumes track playing before battle.
- BattleManager triggers battle music on `start_battle()` and victory/resume on `end_battle()`.
- Crossfade support: smooth transitions between tracks (1 second default).
- Placeholder paths: actual `.ogg` files to be added in future milestone.
- Scenario actions: `play_music`, `play_area_music`, `play_battle_music`, `stop_music`, `check_music`.

### 3.27 Sound effects system
- SFXManager autoload handles sound effect playback.
- SFX_PATHS dictionary maps SFX IDs to `.wav` file paths under `game/assets/audio/sfx/`.
- Audio player pool (8 players) allows simultaneous SFX playback.
- SFX categories: menu (move, select, cancel), battle (hit, miss, defend, victory), interaction (dialogue, pickup).
- `play(sfx_id)`: Plays a specific sound effect.
- Convenience methods: `play_menu_move()`, `play_menu_select()`, `play_attack_hit()`, etc.
- `get_last_sfx()`: Returns the last played SFX ID for testing.
- `stop_all()`: Stops all playing sound effects.
- UI integration: PauseMenuUI plays SFX on navigation and selection.
- Battle integration: BattleScene plays SFX on attacks, defends, victory, defeat.
- Dialogue integration: DialogueManager plays SFX on open/close.
- Inventory integration: InventoryManager plays SFX on tool/item acquisition.
- Placeholder paths: actual `.wav` files to be added in future milestone.
- Scenario actions: `play_sfx`, `check_sfx`, `stop_sfx`.

### 3.28 Notification system
- NotificationManager autoload handles toast/popup notifications.
- Notification types: INFO, QUEST, ITEM, LEVEL_UP, ACHIEVEMENT.
- Queue system: notifications queue and display sequentially with auto-hide after duration.
- `show_notification(title, message, type)`: Generic notification.
- `show_quest_received(quest_name)`: Quest started notification.
- `show_quest_completed(quest_name)`: Quest complete notification.
- `show_item_obtained(item_name, count)`: Item pickup notification.
- `show_tool_acquired(tool_name)`: Tool acquisition notification.
- `show_level_up(character_name, new_level)`: Level up notification.
- QuestManager triggers quest notifications on start/complete.
- InventoryManager triggers item/tool notifications on acquisition.
- NotificationUI (CanvasLayer): animated popup display with slide-in/fade effects.
- Scenario actions: `show_notification`, `show_quest_notification`, `show_item_notification`, `show_level_up_notification`, `check_notification`, `clear_notifications`.

### 3.29 Text size accessibility
- SettingsManager handles text_size setting (0=small, 1=medium, 2=large).
- TEXT_SIZE_SCALES: [0.8, 1.0, 1.3] multipliers for font sizes.
- TEXT_SIZE_NAMES: ["Small", "Medium", "Large"] for display.
- Signal: text_size_changed(new_size: int) emitted on change.
- SettingsUI provides left/right cycling for text size option.
- DialogueUI listens to text_size_changed and applies scale to dialogue labels.
- Font scaling: base font size multiplied by scale factor.
- Settings persisted to user://settings.json with other settings.
- Scenario actions: `set_text_size`, `check_text_size`.

### 3.30 Tutorial hints system
- TutorialHintsManager autoload handles contextual help popups.
- Hint definitions: id, title, message, priority for each mechanic.
- Built-in hints: movement, interact, dialogue, battle_start, battle_attack, battle_defend, quest_board, inventory, save_game.
- Hints show once per game (first-time mechanics), then persist as dismissed.
- Hint queue: if a hint is showing, additional hints queue and display sequentially.
- Dismissed hints stored in `user://tutorial_hints.json`.
- TutorialHintUI (CanvasLayer): animated popup with title, message, dismiss instruction.
- Hints can be enabled/disabled globally via `hints_enabled`.
- API: `show_hint(hint_id)`, `dismiss_current_hint()`, `has_seen_hint(hint_id)`, `reset_hint(hint_id)`, `reset_all_hints()`, `set_hints_enabled(enabled)`.
- Signals: `hint_shown(hint_id)`, `hint_dismissed(hint_id)`.
- Save/load integration via `get_save_data()`, `load_save_data(data)`.
- Scenario actions: `show_hint`, `dismiss_hint`, `check_hint`, `reset_hint`, `reset_all_hints`, `set_hints_enabled`.

### 3.31 Performance optimization
- VisibilityCuller script disables processing for off-screen entities.
- Uses VisibleOnScreenNotifier2D to detect screen visibility.
- Configurable: cull_physics_process, cull_process for process callback control.
- AnimationPlayer pausing: pauses animations when off-screen for CPU savings.
- VisibilityCuller.tscn prefab available for easy scene integration.
- Scenario actions: `check_fps`, `spawn_stress_entities`, `stress_loop` for performance testing.
- Player.gd already optimized: minimal _physics_process, pixel snapping on integers.
- Godot 4 built-in culling: 2D sprites auto-culled when outside camera viewport.

### 3.32 Cutscene system
- CutsceneManager autoload handles playing scripted story sequences.
- Cutscene data stored in `game/data/cutscenes/cutscenes.json`.
- Cutscene data format:
  - Each cutscene has: id, name, steps[], background_color, music.
  - Step types: text (speaker, text, duration), wait (duration), shake (intensity, duration), flash (color, duration).
- CutsceneUI (CanvasLayer): visual overlay for cutscene playback.
  - Text panel with speaker name and dialogue text.
  - Typewriter effect for text display.
  - Skip hint shows when skipping is allowed.
  - Flash and shake visual effects.
- Skip support: Press cancel action to skip cutscene if can_skip is true.
- Advance support: Press interact/accept to speed up typewriter or advance step.
- Game pauses during cutscene playback (process_mode = PROCESS_MODE_ALWAYS on CutsceneUI).
- Signals: `cutscene_started(cutscene_id)`, `cutscene_step_completed(step_index)`, `cutscene_finished(cutscene_id)`, `cutscene_skipped(cutscene_id)`.
- Scenario actions: `play_cutscene`, `skip_cutscene`, `check_cutscene`, `wait_cutscene_end`.

### 3.33 Photo mode
- PhotoModeManager autoload handles screenshot capture feature.
- Photos saved to `user://photos/` as PNG files with timestamp naming.
- PhotoModeUI (CanvasLayer): controls overlay for photo mode.
  - Take Photo button: captures screenshot.
  - Hide UI button: toggles visibility of all game UI.
  - Exit button: exits photo mode.
- Game pauses during photo mode (process_mode = PROCESS_MODE_ALWAYS on PhotoModeUI).
- Flash effect on photo capture.
- Photo count display shows total saved photos.
- Hide UI recursively hides all CanvasLayers with layer >= 10 (preserves game layers).
- Signals: `photo_mode_entered`, `photo_mode_exited`, `photo_taken(path)`, `ui_hidden`, `ui_shown`.
- Scenario actions: `enter_photo_mode`, `exit_photo_mode`, `take_photo`, `hide_photo_ui`, `show_photo_ui`, `check_photo_mode`.

### 3.34 Achievement system
- AchievementManager autoload handles achievement tracking and unlocking.
- Achievement data stored in `game/data/achievements/achievements.json`.
- Achievement data format:
  - Each achievement has: id, name, description, icon, hidden, trigger, trigger_value, points.
  - Trigger types: game_started, areas_visited, npcs_talked, battles_won, quests_started, quests_completed, tools_acquired, photos_taken, secret_found, story_flag.
- Progress tracking via `record_progress(trigger_type, amount)` - auto-unlocks when threshold reached.
- Persistence: unlocked achievements and progress stored in `user://achievements.json`.
- AchievementPopupUI (CanvasLayer): animated notification popup on unlock.
  - Shows icon, name, description, and points earned.
  - Queue system for multiple unlocks.
- Signals: `achievement_unlocked(id, data)`, `achievement_progress(id, current, target)`.
- Scenario actions: `unlock_achievement`, `record_progress`, `check_achievement`, `reset_achievements`.

### 3.35 Localization system
- LocalizationManager autoload handles language switching.
- Supported locales: en (English), es (Español), fr (Français).
- Translations stored in `game/data/localization/translations.csv`.
- CSV format: keys column + one column per locale.
- TranslationServer.set_locale() for runtime switching.
- SettingsUI language option with left/right cycling.
- SettingsManager persists locale preference.
- Signals: `language_changed(locale)`, `locale_changed(locale)`.
- Scenario actions: `set_locale`, `check_locale`, `check_translation`.
- Note: CSV requires Godot Editor import to generate .translation files.

### 3.36 Analytics system (stub)
- AnalyticsManager autoload handles event tracking.
- Session management: start_session(), end_session(), get_session_duration().
- Event buffer: stores up to 100 events locally.
- Standard events: track_area_enter(), track_battle_start/end(), track_quest_start/complete(), track_item_acquired(), track_tool_acquired(), track_npc_interact(), track_save/load_game(), track_achievement(), track_level_up(), track_cutscene_start/skip().
- Custom events: track_event(name, properties).
- Stub methods for backend integration: flush_to_backend(), set_user_id(), set_user_property().
- Signals: event_logged, session_started, session_ended.
- Scenario actions: `track_event`, `check_analytics`, `clear_analytics`.
- Note: No data is sent externally - stub for future backend integration.

### 3.37 Crash reporting (stub)
- CrashReportManager autoload handles error logging.
- Error buffer: stores up to 50 errors locally.
- Log file: `user://crash_reports/error_log.txt` with rotation.
- Error logging: log_error(message, type), log_warning(message), log_exception(message).
- Session tracking: logs session start/end with platform and version info.
- Stub methods for backend: upload_crash_report(), upload_all_reports().
- Signals: error_logged, crash_report_uploaded.
- Scenario actions: `log_error`, `check_crash_reports`, `clear_crash_reports`.
- Note: No data is sent externally - stub for future backend integration.

### 3.38 Debug console
- DebugConsole autoload provides developer console for debugging.
- Toggle: Press backtick (`) or "debug_console" action.
- Commands: help, spawn, teleport, heal, give_tool, give_item, set_flag, set_time, set_weather, fps, reload_data.
- Console UI: top panel with input field and output label.
- Signal: `command_executed(command, args, result)` for tracking.
- Scenario actions: `toggle_debug_console`, `show_debug_console`, `hide_debug_console`, `debug_command`, `check_debug_console`.
- Cheat commands (disabled in release builds):
  - `godmode`: Toggle invincibility for player.
  - `goto <area_name>`: Warp to any area (e.g., town_center, forest_path).
  - `cheats`: Show cheat status.

### 3.39 Fishing minigame
- FishingSpot (Area2D): Interactable fishing locations in the world.
- Requires `fishing_rod` tool to fish.
- FishingMinigame (CanvasLayer): Timing-based cast/catch mechanic.
  - Cast phase: Power bar oscillates; press to set cast power.
  - Wait phase: Wait for fish to bite (random delay based on cast power).
  - Catch phase: Indicator moves across bar; press when in target zone to catch.
  - Harder fish = smaller target zone, faster indicator.
- Fishing data stored in `game/data/fishing/fishing.json`:
  - fish[]: id, name, description, rarity, locations[], difficulty, value.
  - fishing_spots[]: id, name, area, fish_pool[].
  - rarity_weights: common(60), uncommon(25), rare(12), legendary(3).
- Fish rarities: common, uncommon, rare, legendary.
- 8 fish types: common_carp, spotted_trout, silver_minnow, rainbow_bass, golden_koi, bubble_fish, forest_catfish, crystal_perch.
- 4 fishing spots: town_park_pond, bubblegum_shore, forest_stream, grove_pool.
- Fish items added to inventory on successful catch.
- Scenario: `fishing_minigame_smoke`.

### 3.40 Bug catching minigame
- BugSpawner (Area2D): Spawns bugs in grass areas for catching.
- Requires `bug_net` tool to catch bugs.
- BugCatchingMinigame (CanvasLayer): Chase-and-catch mechanic.
  - Searching phase: Bug moves around screen, bouncing off walls.
  - Chasing phase: Player tracks bug movement.
  - Catch phase: Press action when bug is in catch zone.
  - Harder bugs = faster movement, smaller catch window.
- Bug data stored in `game/data/bugs/bugs.json`:
  - bugs[]: id, name, rarity, locations[], speed, value, time_of_day[].
  - spawn_areas[]: id, area, bug_pool[].
  - rarity_weights: common(55), uncommon(28), rare(14), legendary(3).
- Bug rarities: common, uncommon, rare, legendary.
- 8 bug types: common_butterfly, ladybug, grasshopper, firefly, dragonfly, stag_beetle, rainbow_moth, crystal_beetle.
- 3 spawn areas: town_park_grass, bubblegum_shore, forest_stream.
- Time-of-day spawning: some bugs only appear at certain times (firefly at night, etc.).
- Bug items added to inventory on successful catch.
- BugCollectionLog (CanvasLayer): UI showing caught bugs and collection percentage.
- Scenario: `bug_catching_smoke`.

### 3.41 Collection log system
- CollectionLogManager autoload tracks collectibles across categories.
- Collection data stored in `game/data/collections/collections.json`:
  - categories[]: id, name, description, data_source, data_key.
  - milestones[]: percent thresholds (25, 50, 75, 100) with reward_gold and reward_items[].
- Categories: fish (from fishing.json), bugs (from bugs.json).
- API: `record_collection(category, item_id, count)`, `get_collected_count(category)`, `get_total_count(category)`.
- `get_completion_percent(category)`: Returns percentage of unique items collected.
- `get_overall_completion_percent()`: Returns overall completion across all categories.
- `is_item_collected(category, item_id)`: Checks if specific item was collected.
- Milestones: claimable rewards at 25%, 50%, 75%, 100% completion.
- `claim_milestone(category, percent)`: Claims reward, returns reward dict or empty if already claimed.
- `get_claimable_milestones(category)`: Returns array of reached but unclaimed milestone percents.
- Signals: `collection_updated(category)`, `milestone_reached(category, percent, reward_gold)`.
- CollectionLogUI (CanvasLayer): displays categories, items, progress, and milestone rewards.
  - Category tabs for switching views.
  - Items show as ??? until collected, then display name and count.
  - Progress bars for category and overall completion.
  - Claim button for reached milestones.
- Persistence: progress saved to `user://collection_log.json`.
- Scenario actions: `record_collection`, `check_collection`, `check_overall_collection`, `claim_milestone`, `reset_collection`.
- Scenario: `collection_log_smoke`.

## 4. Party and characters
- Party size: 4 total (main character + 2 additional + pet).
- Overworld: party followers are allowed; equal size and consistent spacing.
- Optional recruitable members: Scout (ranger), Bookworm (mage) - unlocked via recruitment quests.
- Recruitment quests: recruit_scout (forest), recruit_bookworm (library).

### 4.1 Pet companion
- PetCompanion: CharacterBody2D that follows the player at consistent spacing (~32px).
- Follow behavior: moves towards player when distance exceeds threshold.
- Sprites: idle (4 directions), walk cycle (4 directions x 2 frames).
- Random idle animations: sit, scratch, yawn - triggered after ~5 seconds of standing still.
- Pet starts in Hero House Interior, follows player between rooms.

### 4.2 Pet variants and selection
- 3 pet variants available: Maddie (cat), Buddy (dog), Nibbles (hamster).
- Pet selection occurs at game start (after intro narration, before gameplay).
- PetSelectionUI: CanvasLayer with pet buttons, description panel, confirm button.
- Pet data stored in `game/data/party/party.json` under `pet_options` array.
- Each pet has: id, name, type, description, stats (max_hp, max_mp, attack, defense, speed), skills[], sprite_path.
- Pet skills unique per type:
  - Cat: scratch, pounce.
  - Dog: bark, fetch.
  - Hamster: squeak, nibble.
- PartyManager API:
  - `get_pet_options()`: Returns array of available pet data.
  - `set_active_pet(pet_id)`: Sets active pet, updates party_state.
  - `get_active_pet()`: Returns active pet ID.
  - `get_active_pet_data()`: Returns active pet's full data.
- Signal: `pet_selected(pet_id)` emitted on selection.
- Scenario actions: `check_pet_options`, `set_active_pet`, `check_active_pet`.

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

### 5.5.1 Content hot reload
- GameData supports hot reload for development: `enable_hot_reload(true)`.
- When enabled, GameData polls file timestamps every 1 second.
- On file change, `reload_all()` clears caches and reloads all JSON data.
- Signal `data_reloaded(category)` emitted after reload.
- Hot reload disabled by default; intended for editor/development only.
- Scenario actions: `enable_hot_reload`, `reload_data`, `check_hot_reload`.

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

### 7.3 Forest Entrance (v0 blockout)
- Transition area: connects Town Park to deeper forest areas.
- Dark green forest background with forest edge borders (darker tree lines).
- Central clearing for player movement between transitions.
- Wooden arch/gate prop (32x48) at the entrance from town side.
- Warning sign prop (16x16) with interactable dialogue about dangers ahead.
- Props: 10 trees scattered around edges, wooden arch, warning sign.
- Enemy: Sneaky Snake (green snake with poison bite attack, 12 HP, visible overworld enemy).
- Transitions: to Town Park (south, "from_forest" spawn), to Forest Path (east, "from_entrance" spawn).
- Spawn markers: default, from_park, from_forest.
- Battle background: forest_clearing.png (512x288).
- Scenario: `forest_entrance_render` for visual/interaction testing.

### 7.4 Forest Path (v0 blockout)
- Winding path through dense forest connecting Forest Entrance to deeper areas.
- Very dark green forest background with dense tree borders.
- Winding dirt path layout (not straight, curves around trees).
- Mushroom props: small (8x8), medium (12x12), large (16x16) red-capped mushrooms.
- Props: 15+ trees creating dense forest feel, 9 mushrooms of varying sizes.
- Hidden alcoves: 2 small clearings off the main path for exploration rewards.
- Interactable alcove spots with discovery dialogue.
- Transitions: to Forest Entrance (west, "from_entrance" spawn), to Forest Deep (east, "from_path" spawn).
- Spawn markers: default, from_entrance, from_deep.
- Enemy: Angry Acorn (cute acorn with angry face, uses roll attack, 10 HP, visible overworld enemy).
- Enemy: Grumpy Stump (camouflaged tree stump, high defense 8, slow but tanky, 20 HP).
- Battle background: deep_woods.png (512x288).
- Scenario: `forest_path_render` for visual/interaction testing.

### 7.5 Clubhouse Exterior (v0 blockout)
- Secret clubhouse in the woods, accessible from Forest Path.
- Forest clearing background with dark green borders.
- Large tree with treehouse structure (48x64 sprite) and rope ladder (16x48).
- "No Adults" sign (16x16) with interactable dialogue.
- Props: 8 trees around clearing, treehouse structure, rope ladder.
- Interactables: rope ladder (climb dialogue), "No Adults" sign (kids only message).
- Transitions: to Forest Path (southwest, "from_clubhouse" spawn), to Clubhouse Interior (via rope ladder).
- Spawn markers: default, from_path, from_interior.
- Scenario: `clubhouse_exterior_render` for visual/interaction testing.

### 7.5.1 Clubhouse Interior (v0 blockout)
- Cozy treehouse interior accessible via rope ladder from exterior.
- Warm brown wooden floor and walls.
- Decorative rug in center for gathering area.
- Props: 4 pillows (pink and blue variants), snack stash box, comic book stacks, wall map.
- Interactables: wall map (shows treasure X), snack stash (chips and candy), comics ("Super Bunny Adventures"), pillow area (club meeting spot).
- Transitions: to Clubhouse Exterior (south, "from_interior" spawn).
- Spawn markers: default, from_exterior.
- Scenario: `clubhouse_interior_render` for visual/interaction testing.

### 7.5.2 Hidden Grove (v0 blockout)
- Magical hidden clearing accessible from Forest Path.
- Very dark green forest background with dense tree borders.
- Central fairy ring of 12 magical mushrooms forming a circle.
- Props: 6 trees around perimeter, 12 fairy mushrooms in ring formation, 5 glowing flowers, lore scroll.
- Interactables: fairy ring center (legend dialogue), lore scroll pickup (ancient forest lore item).
- Transitions: to Forest Path (west, "from_grove" spawn).
- Spawn markers: default, from_forest.
- Battle background: grove.png (512x288).
- Scenario: `hidden_grove_render` for visual/interaction testing.

### 7.5.3 Dark Hollow (v0 blockout)
- Very dark forest area requiring lantern tool to navigate.
- Dark blue/black background with minimal visibility.
- DarkAreaOverlay (CanvasModulate) applies dark tint; fades when player has lantern.
- Props: 8 trees around perimeter, treasure chest in hidden alcove.
- Interactables: TreasureChest (requires lantern, gives 5 ethers, sets "dark_hollow_treasure_found" flag).
- Transitions: to Forest Path (west, "from_hollow" spawn).
- Spawn markers: default, from_path.
- Battle background: deep_woods.png (512x288).
- Scenario: `dark_hollow_smoke` for lantern mechanic testing.

### 7.6 Biome factory workflow
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
