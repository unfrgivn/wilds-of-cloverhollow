# Wilds of Cloverhollow (Pixel JRPG Scaffold)

This repo is a starter scaffold for building **Wilds of Cloverhollow** as a **classic pixel-art JRPG** in **Godot**.

## Quick start (macOS)
1. Install Godot 4.x (recommended: 4.5).
2. Open this folder in Godot.
3. Run the project.

## Working style
- `spec.md` is the single source of truth.
- Use `/next-milestone` to progress through `docs/working-sessions/plan.md`.
- One commit per milestone.

## Scripts
All scripts assume `GODOT_BIN` points at your Godot executable.

Examples:
- `GODOT_BIN="/Applications/Godot.app/Contents/MacOS/Godot" ./tools/ci/run-smoke.sh`

## Repo layout (high level)
- `spec.md` — game specification and locked decisions
- `AGENTS.md` — agent operating rules (automation + no window control)
- `docs/` — design + pipeline + working session docs
- `.opencode/` — opencode commands, agents, and skills
- `game/` — Godot project content under `res://game/...`
- `art/` — source assets + palettes + recipes (not runtime imports)
- `tools/` — CI scripts, linters, capture tooling stubs
