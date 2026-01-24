# Wilds of Cloverhollow

A cozy, family-friendly JRPG (iOS-first) with:
- 3/4 overhead exploration camera (fixed, no rotation)
- pixel art environments + sprite characters
- visible enemies on the overworld
- classic turn-based battles (pixel art battle backgrounds)

## Repo entry points

- **Product spec (single source of truth):** `./spec.md`
- **Agent operating manual:** `./AGENTS.md`
- **Raw brainstorm notes:** `./NOTES.md`
- **Docs hub:** `./docs/index.md`
- **Working sessions playbook:** `./docs/working-sessions/index.md`

## Tooling prerequisites (local dev)

- Godot 4.5.x (stable)
- Python 3.11+ (palette + validation tools)

## Common commands

> These will work once the corresponding scripts are implemented by the coding agent.

- Run the game:
  - `godot --path .`

- Headless smoke boot:
  - `./tools/ci/run-smoke.sh`

- Run tests (headless):
  - `./tools/ci/run-tests.sh`

- Run an automated scenario capture (no window control required):
  - `./tools/ci/run-scenario.sh area01_smoke`

## Where assets live

- `art/` contains source assets, templates, and deterministic baking recipes.
- `game/assets/` contains Godot-imported, runtime assets.

Do not hand-edit baked outputs in `game/assets/`. Fix issues at the source/template level.
