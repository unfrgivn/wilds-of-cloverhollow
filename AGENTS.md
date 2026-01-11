# Agent Instructions — Wilds of Cloverhollow

A Godot 4.5 EarthBound-inspired exploration RPG. This file guides AI agents working in this codebase.

## Required Reading

Before starting any work, agents MUST read:
1. **`spec.md`** — Product specification and requirements (source of truth)
2. **`docs/poc-plan.md`** — Implementation phases and exit criteria
3. **`docs/testing-strategy.md`** — Testing approach and conventions

Additional docs to consult as needed:
- `docs/art-direction.md` — Visual style guidelines
- `docs/art-pipeline.md` — Asset generation workflow
- `docs/earthbound-reference-notes.md` — Inspiration guidelines (what to emulate vs avoid)

**Keep `spec.md` up-to-date**: If requirements change during implementation, update `spec.md` to reflect the current state. The spec is the living source of truth, not a static document.

## Demo Scope (Milestone 1)

Player character **Fae** explores the starter town **Cloverhollow**:
- Walk around town (top-down/oblique view)
- Enter/exit: Fae's House (bedroom + hall), School, Arcade
- Talk to 3 NPCs, interact with objects (signs, containers, beds, arcade machines)
- Complete micro-quest "The Hollow Light": find Blacklight Lantern → reveal hidden sigils → trigger arcade cabinet

**Out of scope**: battles, save/load, multiple party members, audio production.

## Quick Reference

| Task | Command |
|------|---------|
| Headless smoke test | `godot --headless --path . --quit` |
| Run project | `godot --path .` or use `godot_run_project` MCP tool |
| Run all tests (GUT) | `godot --headless --path . -s addons/gut/gut_cmdln.gd` |
| Run single test | `godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest=test_file.gd` |
| Run test by name | `godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest=test_file.gd -gunit_test_name=test_function_name` |
| Start GDScript LSP | `./tools/start-gdscript-lsp.sh` or `godot --editor --headless --lsp-port 6005 --path .` |

## Project Structure

```
scripts/
  autoloads/       # Singletons: GameState, SceneRouter, UIRoot
  player/          # Player controller, movement
  interactables/   # NPC, Container, Sign, Door base classes
  resources/       # Custom Resource types (ItemData, DialogueData)
scenes/
  bootstrap/       # Main.tscn entry point
  locations/       # Town, House, School, Arcade scenes
  ui/              # Dialogue box, inventory, HUD
assets/            # Imported game assets (sprites, icons)
tests/             # GUT test files (test_*.gd)
```

## GDScript Style Guide

### Naming Conventions
- **Files**: `snake_case.gd` (e.g., `game_state.gd`, `scene_router.gd`)
- **Classes**: `PascalCase` (e.g., `class_name ItemData`)
- **Functions**: `snake_case` (e.g., `add_item()`, `get_flag()`)
- **Variables**: `snake_case` (e.g., `item_count`, `is_active`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_ITEMS`, `DEFAULT_FADE_DURATION`)
- **Signals**: `snake_case` past tense (e.g., `item_added`, `transition_finished`)
- **Private members**: prefix with underscore (e.g., `_internal_state`, `_fade_to_black()`)

### Type Annotations (REQUIRED)
Always use explicit types. No implicit `Variant`.

```gdscript
# Variables
var health: int = 100
var player_name: String = ""
var items: Array[String] = []
var flags: Dictionary = {}

# Function signatures
func add_item(item_id: String, count: int = 1) -> bool:
func get_flag(flag_name: String, default: bool = false) -> bool:
func _process(delta: float) -> void:
```

### File Structure
```gdscript
extends Node  # or appropriate base class
class_name ClassName  # optional, for reusable classes
## Brief description of what this script does

# Signals
signal something_happened
signal value_changed(new_value: int)

# Constants
const MAX_VALUE: int = 100

# Exports (inspector-editable)
@export var speed: float = 200.0
@export var target_scene: String = ""

# Public variables
var is_active: bool = false

# Private variables
var _internal_counter: int = 0

# Onready (node references)
@onready var sprite: Sprite2D = $Sprite2D
@onready var collision: CollisionShape2D = $CollisionShape2D

# Lifecycle methods
func _ready() -> void:
func _process(delta: float) -> void:
func _physics_process(delta: float) -> void:
func _input(event: InputEvent) -> void:

# Public methods
func do_something() -> void:

# Private methods
func _internal_helper() -> void:
```

### Error Handling
- Use `push_warning()` for recoverable issues
- Use `push_error()` for serious problems
- Use `assert()` only in tests or debug builds
- Never silently swallow errors

```gdscript
func get_item(item_id: String) -> ItemData:
    if not items.has(item_id):
        push_warning("[Inventory] Item not found: %s" % item_id)
        return null
    return items[item_id]
```

### Logging Convention
Use bracketed tags for debug output:
```gdscript
print("[SceneRouter] Transitioning to: %s" % scene_path)
print("[GameState] Flag set: %s = %s" % [flag_name, value])
```

## Architecture Rules

### Autoloads (Singletons)
Three global autoloads handle cross-scene state:
- **GameState**: Inventory, quest flags, counters, container state
- **SceneRouter**: Scene transitions, fades, spawn point management
- **UIRoot**: Dialogue, menus, HUD, interaction prompts

Access directly by name: `GameState.add_item("key")`, `SceneRouter.go_to_scene(...)`

### Interactables
All interactable objects implement a common interface:
```gdscript
func get_interaction_prompt() -> String:  # "Talk", "Check", "Open"
func interact(actor: Node) -> void:       # Called when player interacts
func can_interact() -> bool:              # Optional, defaults true
```

### Scene Conventions
- Each location scene has a `SpawnPoints` node with named Marker2D children
- Doors/warps specify `target_scene` and `spawn_id`
- Use Y-sorting for depth (`y_sort_enabled = true` on parent)

### Data-Driven Content
- Items: `res://resources/items/item_name.tres` (ItemData resource)
- Dialogue: `res://resources/dialogue/npc_name.json` or `.tres`
- Never hardcode item names, dialogue text, or quest logic in scripts

## Testing

### GUT Test Structure
```gdscript
extends GutTest

func before_each() -> void:
    # Reset state before each test
    GameState.reset()

func test_adding_item_increases_count() -> void:
    GameState.add_item("candy", 5)
    assert_eq(GameState.get_item_count("candy"), 5)

func test_container_cannot_be_looted_twice() -> void:
    var container_id := "chest_001"
    assert_false(GameState.is_container_looted(container_id))
    GameState.mark_container_looted(container_id)
    assert_true(GameState.is_container_looted(container_id))
```

### Test File Naming
- `test_game_state.gd` — unit tests for GameState
- `test_scene_transitions.gd` — integration tests for SceneRouter
- `test_interaction_*.gd` — E2E-style interaction tests

## Agent Workflow

### Before Making Changes
1. Run headless smoke test to verify project loads
2. Check existing patterns in similar files
3. Use LSP diagnostics on files you'll modify

### After Making Changes
1. Run `godot --headless --path . --quit` to verify no load errors
2. Run relevant tests
3. Check LSP diagnostics on changed files

### Skills Available
Use `/skill-name` to load specialized workflows:
- `/smoke` — Headless smoke boot
- `/test` — Run CI tests
- `/scene-audit` — Check scenes for missing spawns/collisions
- `/player-movement-camera` — Implement movement system
- `/scene-transitions` — Implement door/warp transitions
- `/interactions` — Add interactable objects
- `/dialogue-box` — Implement dialogue UI
- `/e2e-tests-gut` — Set up GUT testing

## Do NOT

- Use `Variant` type when a specific type is known
- Hardcode strings that should be data-driven
- Create circular dependencies between autoloads
- Use `await get_tree().process_frame` in tests (use signal waits)
- Commit broken code that fails headless boot
- Skip type annotations on function parameters or returns
- Copy EarthBound sprites, tiles, UI, maps, or text (use for structural inspiration only)
- Place interactables in center of walkable lanes (keep near edges)
