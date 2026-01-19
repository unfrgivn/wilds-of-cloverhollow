# Battle

## Goals
- Classic turn-based flow (Attack / Skills / Items / Defend / Run)
- Fast and readable on iPhone landscape

## Presentation
- Pre-rendered battle background per encounter/biome
- Sprite battlers
- Top HUD for HP/MP/status for both sides
- Bottom command UI (simple boxes to start)

## Party
- Up to 4 party members displayed equally

## Runtime
- Battle logic lives in `res://game/scripts/battle/battle_state.gd`
- Default scene is `res://game/scenes/battle/BattleScene.tscn`
- Scenario automation uses `select_battle_command` actions
