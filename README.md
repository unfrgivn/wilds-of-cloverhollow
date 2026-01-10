# Cloverhollow (Godot 4.5) — EarthBound-inspired exploration RPG demo

This repository is a clean-room, **original** RPG project in **Godot 4.5** that aims to capture the **feel** of classic SNES-era town exploration (readability-first navigation, cutaway interiors, quirky NPC dialogue).

The initial deliverable is a **fully playable demo**:
- Play as **Fae**
- Walk around **Cloverhollow**
- Enter/exit buildings with scene transitions
- Talk to NPCs and interact with objects/containers
- Pick up items and view an inventory
- Use at least one item in the world (Blacklight Lantern)
- Complete a small “weird stakes” micro-quest
- Run automated tests headlessly in CI

## Start here
- Product spec: [`spec.md`](./spec.md)
- Proof-of-concept plan: [`docs/poc-plan.md`](./docs/poc-plan.md)
- Scene list: [`docs/scene-list.md`](./docs/scene-list.md)
- Art direction: [`docs/art-direction.md`](./docs/art-direction.md)
- Art pipeline: [`docs/art-pipeline.md`](./docs/art-pipeline.md)
- Testing: [`docs/testing-strategy.md`](./docs/testing-strategy.md)

## Art references
- User-provided concept samples: `art/reference/concepts/`
- **Do not commit** copyrighted screenshots: `art/reference/earthbound/` (local-only)

## Tooling
- Godot CLI notes: [`tools/godot-cli.md`](./tools/godot-cli.md)
- Test running notes: [`tools/testing.md`](./tools/testing.md)
- Godot MCP notes: [`tools/godot-mcp.md`](./tools/godot-mcp.md)

## Typical commands

Run editor:
```bash
godot --path .
```

Headless smoke boot:
```bash
godot --headless --path . --quit
```

Tests:
- Preferred: GUT (see `tools/testing.md`)
- Optional: GdUnit4 (pin a compatible version for Godot 4.5)

## IP / Legal
This project must **not** use copyrighted EarthBound assets (sprites, maps, music, UI bitmaps, text).
We mimic the *feel* via original art and systems.

## Repo structure
- `docs/` — plans, architecture, art direction, pipelines
- `tools/` — build/test workflows, MCP notes, CI recipes
- `agents/` — role briefs for multi-agent development
- `skills/` — repeatable playbooks for the code agent(s)
- `art/` — prompts, sources, exports, reference packs
- (later) `scenes/`, `scripts/`, `assets/`, `tests/` — Godot project content
