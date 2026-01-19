# Encounters (visible enemies)

## Overworld
- Enemies exist as `EnemyActor` nodes in exploration scenes.
- `EnemyActor` owns a trigger `Area3D` and optional patrol (`move_speed`, `patrol_distance`).
- Contact or `ScenarioRunner` trigger calls `EncounterManager.start_encounter()` to load battle scenes.

## Encounter state
- `EncounterManager` writes state to `GameState` (`return_scene`, `battle_scene`, `encounter_id`, `encounter_source`, `battle_started`).
- Battle scenes call `EncounterManager.finish_encounter(result)` before returning.

## Encounter data
- Encounter table selects enemy roster + battle background.

## Anti-friction rules
- Avoid surprise random encounters.
- Keep spacing so the player can dodge if desired.
