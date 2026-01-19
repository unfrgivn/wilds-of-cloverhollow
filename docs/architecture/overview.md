# Architecture overview

## High-level scene flow

- `game/bootstrap/Main.tscn` boots the game and hands off to `SceneRouter`.
- `SceneRouter` loads area scenes and places the player at spawn markers.
- `GameState` persists party, flags, inventory, quest state.
- `QuestLog` tracks quest progress and completion.
- `ScenarioRunner` can execute deterministic scripted inputs for automation.

## Key constraints
- iOS landscape only
- no OS-level window control required for automation
- deterministic content pipelines (recipes + templates)
