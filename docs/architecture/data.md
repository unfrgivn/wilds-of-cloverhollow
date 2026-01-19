# Data model

All content should be data-driven and stable-id based.

## Stable ids
- Every character, enemy, item, skill, biome, and encounter has an `id`.
- Never rename ids; add new ids and migrate if needed.

## Storage
Two acceptable patterns:
1. Godot `Resource` (`.tres`) assets
2. JSON/YAML in `game/data/...` with a loader

## Biome pack
Biome data should include:
- palette id + shared UI/skin palette
- toon ramp id
- lighting preset id
- prop kit ids
- visible enemy roster ids
- battle background ids
