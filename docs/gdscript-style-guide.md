# GDScript Code Style Guide

This document defines the coding conventions for Wilds of Cloverhollow. All GDScript code must follow these guidelines.

## 1. Formatting

### 1.1 Indentation
- **4 spaces** for indentation (not tabs)
- Exception: Some legacy files may use tabs; maintain consistency within each file

### 1.2 Line Length
- Maximum **120 characters** per line
- Break long lines at logical points (after operators, commas)

### 1.3 Blank Lines
- **2 blank lines** between top-level declarations (classes, functions)
- **1 blank line** between methods within a class
- **0 blank lines** between related variable declarations

### 1.4 Whitespace
```gdscript
# Good
func example(a: int, b: int) -> int:
    return a + b

# Bad - spaces around colons
func example(a : int, b : int) -> int:
    return a + b

# Good - spaces around operators
var result = a + b * c

# Bad
var result=a+b*c
```

---

## 2. Naming Conventions

### 2.1 Case Styles

| Element | Style | Example |
|---------|-------|---------|
| Classes | PascalCase | `BattleManager`, `PlayerStats` |
| Functions | snake_case | `get_player_position()`, `_ready()` |
| Variables | snake_case | `current_health`, `player_position` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_HEALTH`, `DEFAULT_SPEED` |
| Signals | snake_case | `health_changed`, `battle_started` |
| Enums | PascalCase | `enum State { IDLE, RUNNING }` |
| Enum values | SCREAMING_SNAKE_CASE | `State.IDLE`, `State.RUNNING` |

### 2.2 Prefixes

| Prefix | Meaning | Example |
|--------|---------|---------|
| `_` | Private member/method | `_internal_state`, `_calculate_damage()` |
| `is_`, `has_`, `can_` | Boolean getter | `is_alive()`, `has_item()` |
| `get_`, `set_` | Accessor methods | `get_health()`, `set_position()` |
| `on_` | Signal handler | `_on_button_pressed()` |

### 2.3 Naming Guidelines
- Use descriptive names (avoid abbreviations except common ones: `hp`, `mp`, `id`)
- Boolean variables should read as questions: `is_visible`, `has_key`, `can_attack`
- Plural names for collections: `enemies`, `items`, `active_quests`

---

## 3. Code Organization

### 3.1 File Structure
```gdscript
# 1. Class name (if not Node-derived)
class_name MyClass
extends Node

## 2. Documentation comment
## Brief description of what this class does.

# 3. Signals
signal health_changed(new_value: int)
signal item_collected(item_id: String)

# 4. Enums
enum State { IDLE, RUNNING, JUMPING }

# 5. Constants
const MAX_SPEED: float = 100.0
const GRAVITY: float = 980.0

# 6. Exported variables
@export var speed: float = 50.0
@export var jump_height: float = 200.0

# 7. Public variables
var current_state: State = State.IDLE

# 8. Private variables
var _velocity: Vector2 = Vector2.ZERO

# 9. Onready variables
@onready var sprite: Sprite2D = $Sprite2D
@onready var collision: CollisionShape2D = $CollisionShape2D

# 10. Built-in callbacks (_ready, _process, etc.)
func _ready() -> void:
    pass

func _process(delta: float) -> void:
    pass

# 11. Public methods
func take_damage(amount: int) -> void:
    pass

# 12. Private methods
func _calculate_knockback() -> Vector2:
    pass
```

### 3.2 Import Organization
- Use `preload()` for frequently-used resources
- Use `load()` for conditionally-loaded resources
- Group related preloads together

---

## 4. Type Annotations

### 4.1 Always Use Types
```gdscript
# Good - explicit types
var health: int = 100
var position: Vector2 = Vector2.ZERO
var items: Array[String] = []

# Bad - inferred types
var health = 100
var position = Vector2.ZERO
var items = []
```

### 4.2 Function Signatures
```gdscript
# Good - typed parameters and return
func calculate_damage(base: int, multiplier: float) -> int:
    return int(base * multiplier)

# Bad - untyped
func calculate_damage(base, multiplier):
    return base * multiplier
```

### 4.3 Type Inference
- Use `:=` only when type is obvious from right side
- Prefer explicit types for clarity

```gdscript
# Acceptable - type is obvious
var scene := preload("res://scene.tscn")
var dict := {}

# Prefer explicit for ambiguous cases
var value: int = get_some_value()  # Type not obvious
```

---

## 5. Comments and Documentation

### 5.1 Documentation Comments
Use `##` for documentation comments that appear in editor tooltips:

```gdscript
## Player character controller
##
## Handles movement, interaction, and combat for the main character.
class_name Player
extends CharacterBody2D

## Current health points
@export var health: int = 100

## Move the player in a direction
## [param direction]: Normalized movement vector
## [param delta]: Frame delta time
func move(direction: Vector2, delta: float) -> void:
    pass
```

### 5.2 Inline Comments
```gdscript
# Good - explains why, not what
# Clamp to prevent physics issues at high speeds
velocity = velocity.limit_length(MAX_SPEED)

# Bad - describes obvious code
# Set velocity to limited velocity
velocity = velocity.limit_length(MAX_SPEED)
```

### 5.3 TODO Comments
```gdscript
# TODO: Implement animation blending
# FIXME: Memory leak when reloading scenes
# HACK: Temporary workaround for Godot bug #12345
```

---

## 6. Best Practices

### 6.1 Avoid Magic Numbers
```gdscript
# Bad
if distance < 50:
    attack()

# Good
const ATTACK_RANGE: float = 50.0
if distance < ATTACK_RANGE:
    attack()
```

### 6.2 Early Returns
```gdscript
# Good - early return
func process_input() -> void:
    if not is_active:
        return
    if is_stunned:
        return
    _handle_movement()
    _handle_combat()

# Bad - deep nesting
func process_input() -> void:
    if is_active:
        if not is_stunned:
            _handle_movement()
            _handle_combat()
```

### 6.3 Signal Connections
```gdscript
# Prefer callable syntax
button.pressed.connect(_on_button_pressed)

# For signals with parameters
health_bar.value_changed.connect(_on_health_changed)
```

### 6.4 Resource Handling
```gdscript
# Preload for guaranteed resources
const EXPLOSION_SCENE = preload("res://effects/explosion.tscn")

# Load for optional/dynamic resources
var custom_sprite = load(user_sprite_path)
```

### 6.5 Error Handling
```gdscript
# Check for null
var node = get_node_or_null("OptionalChild")
if node != null:
    node.do_something()

# Use push_warning for non-critical issues
if items.is_empty():
    push_warning("[Inventory] Attempted to use empty inventory")
    return

# Use push_error for critical issues
if save_data == null:
    push_error("[SaveManager] Failed to load save data")
    return
```

---

## 7. Anti-Patterns

### 7.1 Never Use
- `as any` equivalent type casting without checks
- Empty catch blocks
- Global state via singletons (prefer autoloads with clear interfaces)
- String-based node paths when references work

### 7.2 Avoid
- Deeply nested conditionals (use early returns)
- Long functions (break into smaller functions)
- Duplicate code (extract to shared functions)
- Hard-coded strings for IDs/keys (use constants)

---

## 8. Linter Configuration

The project uses gdlint for style checking.

### 8.1 Running the Linter
```bash
# Check all GDScript files
./tools/lint/gdlint.sh

# Check specific file
gdlint game/scripts/player/Player.gd
```

### 8.2 Disabling Rules (sparingly)
```gdscript
# gdlint: disable=line-too-long
var very_long_line_that_cannot_be_reasonably_broken = "some value"
# gdlint: enable=line-too-long
```

---

## 9. Checklist

Before committing code:

- [ ] All functions have type annotations
- [ ] No magic numbers (use constants)
- [ ] Naming follows conventions
- [ ] Code is properly indented (4 spaces)
- [ ] Comments explain "why" not "what"
- [ ] No `push_warning` in hot paths
- [ ] Signals use callable syntax
- [ ] File follows organization structure
