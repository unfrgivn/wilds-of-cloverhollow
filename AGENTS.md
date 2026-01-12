# Agent Instructions — Layout-Authoritative Scene Pipeline Prototype

A Godot 4.5 technical prototype that validates a JSON + walkmask scene pipeline. This file guides AI agents working in this codebase.

## Required Reading

Before starting any work, agents MUST read:
1. **`spec.md`** — Product specification and requirements (source of truth)
2. **`docs/reference_notes.md`** — Resolution, camera, and platform constraints

## Prototype Scope (Milestone 1)

Focus on the pipeline only:
- JSON-driven scene loading
- Walkmask-based navigation blocking
- Hotspot/exit/spawn definitions in JSON
- Headless validator that enforces bounds and reachability

**Out of scope**: quests, NPC dialogue, inventory, combat, audio, save/load.

## Quick Reference

| Task | Command |
|------|---------|
| Headless smoke test | `godot --headless --path . --quit` |
| Run project | `godot --path .` |
| Run validator | `godot --headless --path . --script res://tools/validate_scenes.gd` |

## GDScript Style Guide

### Naming Conventions
- **Files**: `snake_case.gd`
- **Classes**: `PascalCase`
- **Functions**: `snake_case`
- **Variables**: `snake_case`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Signals**: `snake_case` past tense
- **Private members**: prefix with underscore

### Type Annotations (REQUIRED)
Always use explicit types. No implicit `Variant`.

```gdscript
var speed: float = 200.0
var flags: Dictionary = {}

func is_walkable(point: Vector2) -> bool:
func _physics_process(delta: float) -> void:
```

### File Structure
```gdscript
extends Node
class_name ClassName

# Signals
# Constants
# Exports
# Public variables
# Private variables
# Onready
# Lifecycle methods
# Public methods
# Private methods
```

### Error Handling
- Use `push_warning()` for recoverable issues
- Use `push_error()` for serious problems
- Use `assert()` only in tests or debug builds
- Never silently swallow errors

### Logging Convention
Use bracketed tags for debug output:
```gdscript
print("[SceneRunner] Loading scene: %s" % scene_id)
print("[WalkMask] Sample %s => %s" % [point, is_walkable])
```

## Architecture Rules

- JSON is the source of truth for scene layout and triggers.
- World blocking must use walkmask sampling, not physics collisions.
- Do not introduce tilemaps or hand-authored collision polygons for blocking.
