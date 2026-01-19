# AGENTS.md — Operating Manual for Coding + Content Agents

This repo is designed to be driven by autonomous agents (opencode) without requiring OS-level control of a running game window.

## 1) Non-negotiable workflow

1. **Spec-first**: read and follow `./spec.md`. If you change behavior or formats, update `spec.md` in the same change.
2. **Automate everything**: features must be testable headlessly and/or via Scenario Runner.
3. **No manual, irreproducible art**: runtime assets must be reproducible from `art/recipes/...` + `art/templates/...`.

## 2) Repo conventions

### 2.1 Godot paths
- Game code lives under: `res://game/...` (repo folder `./game/...`)
- Use `res://game/scenes/...` for scenes and `res://game/scripts/...` for scripts.

### 2.2 Naming
- Scenes: `PascalCase.tscn` or `Area_<Biome>_<Name>.tscn`
- Scripts: `snake_case.gd` or `PascalCase.gd` (pick one and stay consistent)
- Data resources: `*.tres` with stable ids

### 2.3 Asset boundaries
- `art/` is source-of-truth for generation templates, recipes, and raw outputs.
- `game/assets/` is *runtime/imported* only. Do not hand-edit generated outputs.

## 3) Required automation entrypoints

Agents must maintain these scripts:
- `tools/ci/run-smoke.sh`
- `tools/ci/run-tests.sh`
- `tools/ci/run-scenario.sh <scenario_id>`

### 3.1 Scenario Runner requirements
The game must support running a deterministic scenario from CLI args:
- `--scenario <id>`
- `--capture_dir <dir>`
- `--seed <int>`
- `--quit_after_frames <int>`

The Scenario Runner must be able to:
- load an area
- move to a waypoint
- interact with an object/NPC
- trigger a visible enemy encounter
- execute one full battle turn
- exit

## 4) Recommended agent roles (opencode)

These are configured under `./.opencode/agent/`.

- **product-architect**: keeps `spec.md` coherent; defines acceptance criteria.
- **godot-gameplay-engineer**: exploration systems, SceneRouter, GameState.
- **battle-systems**: battle loop, turn system, data models.
- **ui-systems**: dialogue, battle HUD, touch controls + safe-area.
- **world-scene-builder**: area scenes, collisions, nav mesh, spawns, visible enemies.
- **art-pipeline**: Blender templates, palette/ramp tools, bake scripts, validators.
- **qa-automation**: test framework, CI reliability, scenario capture stability.

## 5) Definition of done (any feature)

A feature is "done" only if:
- `spec.md` updated (if requirements/behavior changed)
- tests added/updated OR scenario updated
- `./tools/ci/run-spec-check.sh` passes
- `./tools/ci/run-smoke.sh` passes
- `./tools/ci/run-tests.sh` passes
- `./tools/ci/run-visual-regression.sh` passes (golden capture + diff)
- At least one scenario capture can be produced deterministically

