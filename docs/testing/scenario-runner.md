# Scenario Runner Guide

The Scenario Runner enables deterministic, automated game testing without OS-level window control. Scenarios are JSON files that script game actions and capture artifacts for verification.

## Quick Start

```bash
# Run a scenario
./tools/ci/run-scenario.sh exploration_walk_smoke

# Run with visual capture
./tools/ci/run-scenario-rendered.sh town_center_render
```

## CLI Arguments

| Argument | Description |
|----------|-------------|
| `--scenario <id>` | Scenario ID (looks for `tests/scenarios/<id>.json`) |
| `--seed <int>` | Random seed for deterministic behavior |
| `--capture_dir <path>` | Directory for screenshots and trace output |
| `--quit_after_frames <int>` | Auto-quit after N frames |

Example:
```bash
godot --path . -- --scenario exploration_walk_smoke --seed 12345 --capture_dir captures/run1 --quit_after_frames 120
```

## Scenario File Format

```json
{
  "scenario_id": "my_scenario",
  "description": "What this scenario tests",
  "scene": "res://game/scenes/areas/Area_TownCenter.tscn",
  "actions": [
    {"type": "wait_frames", "frames": 10},
    {"type": "capture", "label": "start"}
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `scenario_id` | Yes | Unique identifier |
| `description` | No | Human-readable purpose |
| `scene` | No | Starting scene (optional override) |
| `actions` | Yes | Array of action objects |

## Action Reference

### Core Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `wait_frames` | `frames: int` | Pause for N physics frames |
| `capture` | `label: string` | Save screenshot with label |
| `move` | `direction: string, frames: int` | Inject movement (left/right/up/down) |
| `press` | `action: string` | Simulate input action press/release |
| `load_scene` | `scene: string` | Change to a scene by path |

### Save/Load Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `save_game` | `slot: int` | Save to slot (0-2) |
| `load_game` | `slot: int` | Load from slot |
| `delete_save` | `slot: int` | Delete save slot |
| `has_save` | `slot: int` | Check if slot has save |
| `check_save_slots` | - | Log all slot previews |

### Inventory Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `acquire_tool` | `tool_id: string` | Give player a tool |
| `check_tool` | `tool_id: string` | Check if player has tool |
| `add_inventory_item` | `item_id: string, count: int` | Add items |
| `remove_inventory_item` | `item_id: string, count: int` | Remove items |
| `check_inventory` | `item_id: string` | Check item count |

### Story Flag Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `set_story_flag` | `flag: string, value: bool` | Set a story flag |
| `check_story_flag` | `flag: string` | Check flag status |

### Quest Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `start_quest` | `quest_id: string` | Start a quest |
| `complete_quest` | `quest_id: string` | Complete a quest |
| `complete_objective` | `quest_id: string, objective_index: int` | Mark objective done |
| `check_quest` | `quest_id: string` | Check quest status |

### UI Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `open_inventory` | - | Open inventory UI |
| `close_inventory` | - | Close inventory UI |
| `open_party_status` | - | Open party status UI |
| `close_party_status` | - | Close party status UI |
| `open_quest_log` | - | Open quest log UI |
| `close_quest_log` | - | Close quest log UI |
| `open_map` | - | Open map screen |
| `close_map` | - | Close map screen |
| `open_settings` | - | Open settings UI |
| `close_settings` | - | Close settings UI |
| `pause_game` | - | Pause the game |
| `unpause_game` | - | Unpause the game |
| `toggle_pause` | - | Toggle pause state |
| `check_pause` | - | Log pause status |

### Dialogue Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `show_dialogue_choices` | `prompt: string, choices: array` | Show dialogue with choices |
| `select_dialogue_choice` | `choice_index: int` | Select a choice |
| `hide_dialogue` | - | Close dialogue |

### Time/Weather Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `set_time_phase` | `phase: int` | Set time (0=morning, 1=afternoon, 2=evening, 3=night) |
| `set_weather` | `weather: int` | Set weather (0=clear, 1=rain, 2=storm) |
| `trigger_thunder` | - | Trigger thunder flash |

### Equipment Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `equip_item` | `member_id: string, equip_id: string` | Equip item to party member |
| `unequip_slot` | `member_id: string, slot: string` | Remove equipment from slot |
| `check_equipment` | `member_id: string` | Log equipment and stats |
| `check_party_member` | `member_id: string` | Log party member state |

### Affinity Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `set_affinity` | `npc_id: string, value: int` | Set NPC affinity (0-100) |
| `change_affinity` | `npc_id: string, amount: int` | Change affinity by amount |
| `check_affinity` | `npc_id: string` | Log affinity and level |

### Audio Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `play_music` | `track_id: string` | Play music track |
| `play_area_music` | `area: string` | Play area-appropriate music |
| `play_battle_music` | - | Play battle theme |
| `stop_music` | - | Stop music |
| `check_music` | - | Log current track |
| `play_sfx` | `sfx_id: string` | Play sound effect |
| `check_sfx` | - | Log last played SFX |
| `stop_sfx` | - | Stop all SFX |
| `set_music_volume` | `value: float` | Set music volume (0-1) |
| `set_sfx_volume` | `value: float` | Set SFX volume (0-1) |

### Notification Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `show_notification` | `title: string, message: string` | Show generic notification |
| `show_quest_notification` | `quest_name: string` | Show quest notification |
| `show_item_notification` | `item_name: string, count: int` | Show item obtained |
| `show_level_up_notification` | `character_name: string, new_level: int` | Show level up |
| `check_notification` | - | Log notification status |
| `clear_notifications` | - | Clear all notifications |

### Tutorial/Hints Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `show_hint` | `hint_id: string` | Show tutorial hint |
| `dismiss_hint` | - | Dismiss current hint |
| `check_hint` | `hint_id: string` | Check hint status |
| `reset_hint` | `hint_id: string` | Reset single hint |
| `reset_all_hints` | - | Reset all hints |
| `set_hints_enabled` | `enabled: bool` | Enable/disable hints |

### Cutscene Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `play_cutscene` | `cutscene_id: string, can_skip: bool` | Play a cutscene |
| `skip_cutscene` | - | Skip current cutscene |
| `check_cutscene` | - | Log cutscene status |
| `wait_cutscene_end` | - | Wait for cutscene to finish |

### Photo Mode Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `enter_photo_mode` | - | Enter photo mode |
| `exit_photo_mode` | - | Exit photo mode |
| `take_photo` | - | Capture a photo |
| `hide_photo_ui` | - | Hide photo UI |
| `show_photo_ui` | - | Show photo UI |
| `check_photo_mode` | - | Log photo mode status |

### Achievement Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `unlock_achievement` | `achievement_id: string` | Unlock achievement |
| `record_progress` | `trigger: string, amount: int` | Record progress toward achievement |
| `check_achievement` | `achievement_id: string` | Log achievement status |
| `reset_achievements` | - | Reset all achievements |

### Analytics Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `track_event` | `event: string, properties: dict` | Track analytics event |
| `check_analytics` | - | Log analytics status |
| `clear_analytics` | - | Clear event buffer |

### Crash Reporting Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `log_error` | `message: string, error_type: string` | Log an error |
| `check_crash_reports` | - | Log error count |
| `clear_crash_reports` | - | Clear error buffer |

### Localization Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `set_locale` | `locale: string` | Set locale (en/es/fr) |
| `check_locale` | - | Log current locale |
| `check_translation` | `key: string` | Check translation for key |

### Accessibility Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `set_text_size` | `size: int` | Set text size (0=small, 1=medium, 2=large) |
| `check_text_size` | - | Log text size settings |

### Performance Testing Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `check_fps` | - | Log current FPS |
| `spawn_stress_entities` | `count: int` | Spawn N stress test sprites |
| `stress_loop` | `iterations: int` | Run CPU stress loop |

## Artifacts

After a scenario run, the capture directory contains:

| File | Description |
|------|-------------|
| `trace.json` | Chronological log of all events |
| `*.png` | Captured screenshots at labeled frames |

Example trace structure:
```json
{
  "scenario_id": "exploration_walk_smoke",
  "seed": 12345,
  "capture_dir": "captures/run1",
  "started_at_unix": 1737907200,
  "ended_at_unix": 1737907205,
  "events": [
    {"type": "wait_start", "frame": 1, "frames": 5},
    {"type": "wait_end", "frame": 5},
    {"type": "capture", "frame": 6, "label": "initial"}
  ]
}
```

## Best Practices

### 1. Keep scenarios focused
Each scenario should test one feature or flow. Prefer multiple small scenarios over one monolithic test.

### 2. Use deterministic seeds
Always provide `--seed` for reproducible results:
```json
{"type": "wait_frames", "frames": 10}
```

### 3. Add wait frames for stability
Add short waits after scene loads and UI opens:
```json
{"type": "load_scene", "scene": "res://game/scenes/areas/Area_TownCenter.tscn"},
{"type": "wait_frames", "frames": 5},
{"type": "capture", "label": "scene_loaded"}
```

### 4. Capture before and after state changes
```json
{"type": "capture", "label": "before_equip"},
{"type": "equip_item", "member_id": "hero", "equip_id": "iron_sword"},
{"type": "check_equipment", "member_id": "hero"},
{"type": "capture", "label": "after_equip"}
```

### 5. Use check actions for verification
Check actions log state to trace.json for automated verification:
```json
{"type": "set_story_flag", "flag": "forest_unlocked", "value": true},
{"type": "check_story_flag", "flag": "forest_unlocked"}
```

### 6. Name captures descriptively
Use snake_case labels that describe what's being captured:
- `initial_position` (not `cap1`)
- `after_battle_victory` (not `end`)
- `inventory_with_potions` (not `inv`)

### 7. Create render scenarios for visual regression
Suffix visual test scenarios with `_render`:
```
town_center_render.json
battle_scene_render.json
```

## Example Scenarios

### Simple exploration test
```json
{
  "scenario_id": "town_walk_test",
  "description": "Walk around town center",
  "scene": "res://game/scenes/areas/Area_TownCenter.tscn",
  "actions": [
    {"type": "wait_frames", "frames": 10},
    {"type": "capture", "label": "start"},
    {"type": "move", "direction": "right", "frames": 30},
    {"type": "move", "direction": "up", "frames": 20},
    {"type": "capture", "label": "moved"},
    {"type": "press", "action": "interact"},
    {"type": "wait_frames", "frames": 5},
    {"type": "capture", "label": "end"}
  ]
}
```

### Quest flow test
```json
{
  "scenario_id": "quest_flow_test",
  "description": "Test quest start and completion",
  "actions": [
    {"type": "start_quest", "quest_id": "lost_cat"},
    {"type": "check_quest", "quest_id": "lost_cat"},
    {"type": "complete_objective", "quest_id": "lost_cat", "objective_index": 0},
    {"type": "complete_quest", "quest_id": "lost_cat"},
    {"type": "check_quest", "quest_id": "lost_cat"}
  ]
}
```

### Save/load test
```json
{
  "scenario_id": "save_load_test",
  "description": "Test save and load cycle",
  "actions": [
    {"type": "acquire_tool", "tool_id": "lantern"},
    {"type": "set_story_flag", "flag": "test_flag", "value": true},
    {"type": "save_game", "slot": 0},
    {"type": "has_save", "slot": 0},
    {"type": "load_game", "slot": 0},
    {"type": "check_tool", "tool_id": "lantern"},
    {"type": "check_story_flag", "flag": "test_flag"},
    {"type": "delete_save", "slot": 0}
  ]
}
```

## Troubleshooting

### Scenario not found
Ensure the file exists at `tests/scenarios/<scenario_id>.json` and the JSON is valid.

### Captures are empty/black
In headless mode (no display), captures may be empty. Use `xvfb-run` for virtual display:
```bash
xvfb-run godot --path . -- --scenario my_test --capture_dir captures/
```

### Actions not executing
Check `trace.json` for error events. Common issues:
- Missing required parameters
- Invalid scene paths
- Nonexistent IDs (quest_id, item_id, etc.)

### Scene load failures
Verify scene path includes full `res://` prefix:
```json
{"type": "load_scene", "scene": "res://game/scenes/areas/Area_TownCenter.tscn"}
```
