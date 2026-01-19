# Data model

All content should be data-driven and stable-id based.

## Stable ids
- Every character, enemy, item, skill, biome, and encounter has an `id`.
- Never rename ids; add new ids and migrate if needed.

## Storage
Two acceptable patterns:
1. Godot `Resource` (`.tres`) assets
2. JSON/YAML in `game/data/...` with a loader

## Data registry
The `DataRegistry` autoload loads `.tres` resources from `res://game/data/*` on boot so gameplay systems can query by stable id.

### Current data paths
- `res://game/data/enemies/*.tres` → `EnemyDef`
- `res://game/data/characters/*.tres` → `PartyMemberDef`
- `res://game/data/encounters/*.tres` → `EncounterDef`
- `res://game/data/items/*.tres` → `ItemDef`
- `res://game/data/skills/*.tres` → `SkillDef`
- `res://game/data/biomes/*.tres` → `BiomeDef`

## EncounterDef fields
- `id`
- `enemy_ids`
- `battle_scene`
- `biome_id`
- `battle_background_id`

## Biome pack
Biome data should include:
- palette id + shared UI/skin palette
- toon ramp id
- lighting preset id
- prop kit ids
- visible enemy roster ids
- battle background ids
