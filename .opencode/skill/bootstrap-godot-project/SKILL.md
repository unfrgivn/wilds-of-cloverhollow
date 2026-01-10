---
name: bootstrap-godot-project
description: Bootstrap Godot 4.5 project scaffolding and CI entry points
compatibility: opencode
---
# Skill: Bootstrap Godot 4.5 Project (Agent-friendly)

## Objective
Create a Godot **4.5** project at the repo root with consistent input actions, autoloads, and optional “retro viewport” support.

## Steps

1) Create the project
- Create a new Godot project at the repo root so `project.godot` is at `./project.godot`.

2) Configure display (baseline)
- Choose an internal resolution that keeps UI readable (e.g., 320×240 or 400×240).
- Set stretch mode/aspect so the game letterboxes rather than distorting.
- Keep this simple and explicit in `ProjectSettings` so it’s reproducible.

3) Optional: add a low-res SubViewport “retro filter”
- Create a `RetroViewport.tscn` wrapper:
  - `SubViewport` renders world at low resolution
  - a `TextureRect` or `Sprite2D` displays it scaled up
- Add a toggle flag in settings so you can switch between:
  - direct rendering
  - retro viewport rendering

4) Define InputMap actions (keyboard-first)
- Required:
  - `move_up`, `move_down`, `move_left`, `move_right`
  - `interact`, `menu`, `cancel`
- Suggested bindings:
  - Movement: WASD + arrows
  - Interact: Z (and/or Enter)
  - Cancel: X / Esc
  - Menu: C / Tab

5) Add autoload singletons
- `GameState.gd` (inventory, flags, counters)
- `SceneRouter.gd` (scene transitions + spawn points)
- `UIRoot.gd` (dialogue/inventory overlays) or a `UIRoot.tscn` instanced by Main

6) Create bootstrap scenes
- `scenes/bootstrap/Main.tscn`
  - loads initial scene (town or title)
  - owns fade layer (or delegates to `SceneRouter`)
- Optional:
  - `scenes/bootstrap/Title.tscn` (New Game / Continue)

## Verification checklist
- `godot --path .` launches without errors.
- `godot --headless --path . --quit` returns success (CI smoke boot).
- Input actions exist and are spelled consistently across scripts/tests.
