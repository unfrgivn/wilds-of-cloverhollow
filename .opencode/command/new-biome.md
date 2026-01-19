---
description: Scaffold a new biome pack (docs + data + folder structure)
agent: product-architect
---
Create the boilerplate for a new biome pack:
- docs under `docs/biomes/<biome_id>/`
- data stubs under `game/data/biomes/<biome_id>/`
- art stubs under `art/palettes/`, `art/ramps/`, `art/recipes/`

Use the checklist from `docs/biomes/checklist.md` and `docs/biomes/BIOME_TEMPLATE.md`.

Also:
- Update `spec.md` if the biome should be listed under Initial biomes.
- Add a stub Scenario Runner scenario under `tests/scenarios/` for regression.
