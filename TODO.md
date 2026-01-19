# TODO

## Milestones

### M1 Exploration and Scene Routing
Owner: godot-gameplay-engineer

Acceptance Criteria
- Given the game boots into Fae’s house, When the player reaches the exit trigger, Then SceneRouter loads Cloverhollow town and spawns at the configured spawn point.
- Given the exploration camera is fixed 3/4, When the player moves, Then facing snaps to 8 directions with analog movement.
- Given collisions and navigation are in place, When the player walks into walls or props, Then movement is blocked deterministically.

File paths
- `game/scenes/Area_FaeHouse.tscn`
- `game/scenes/Area_Cloverhollow_Town.tscn`
- `game/scenes/SceneRouter.tscn`
- `game/scripts/scene_router.gd`
- `game/scripts/player_controller.gd`
- `game/data/areas/area_fae_house.tres`
- `game/data/areas/area_cloverhollow_town.tres`

### M2 Interaction System
Owner: interactions

Acceptance Criteria
- Given Fae is near an interactable, When the interact action is pressed, Then the correct interaction fires with a deterministic prompt.
- Given an NPC, When interacted, Then a dialogue sequence plays and exits cleanly without camera changes.
- Given a sign and container, When interacted, Then the sign shows text and the container yields a stub item event.

File paths
- `game/scripts/interactions/interactable.gd`
- `game/scripts/interactions/interact_prompt.gd`
- `game/scripts/dialogue/dialogue_controller.gd`
- `game/scenes/props/Sign.tscn`
- `game/scenes/props/Container.tscn`
- `game/scenes/npcs/NpcBasic.tscn`
- `game/data/interactions/interaction_sign.tres`
- `game/data/interactions/interaction_container.tres`

### M3 Visible Enemy and Encounter Trigger
Owner: world-scene-builder

Acceptance Criteria
- Given an overworld enemy is visible, When the player touches its trigger, Then an encounter transition starts deterministically.
- Given the encounter is triggered, When battle ends in victory, Then the enemy despawns or is marked defeated and the player returns to exploration.

File paths
- `game/scenes/enemies/EnemyOverworld.tscn`
- `game/scripts/enemy_overworld.gd`
- `game/data/encounters/encounter_cloverhollow.tres`
- `docs/gameplay/encounters.md`

### M4 Battle Loop and Return to Exploration
Owner: battle-systems

Acceptance Criteria
- Given a battle starts, When the command menu is shown, Then the player can choose Attack and a full turn resolves deterministically.
- Given the enemy HP reaches 0, When the victory state triggers, Then the game transitions back to exploration without errors.
- Given the battle background is assigned, When the scene loads, Then the correct pre-rendered PNG is displayed.

File paths
- `game/scenes/battle/BattleScene.tscn`
- `game/scripts/battle/battle_controller.gd`
- `game/scripts/battle/turn_queue.gd`
- `game/scripts/battle/commands.gd`
- `game/data/battle/party.tres`
- `game/data/battle/enemies/enemy_cloverhollow.tres`
- `game/assets/battle_backgrounds/cloverhollow.png`
- `docs/gameplay/battle.md`
- `docs/ui/battle-ui.md`

### M5 Fast-Travel Stub (Bus Stop)
Owner: ui-systems

Acceptance Criteria
- Given the bus stop is interacted with, When the menu opens, Then a placeholder UI appears with no travel executed.
- Given iOS safe-area constraints, When the bus stop UI is shown, Then all UI stays within the safe area at 1920×1080 reference scaling.

File paths
- `game/scenes/ui/BusStopMenu.tscn`
- `game/scripts/ui/bus_stop_menu.gd`
- `game/scenes/props/BusStop.tscn`
- `docs/ui/ios-touch-and-safe-area.md`

### M6 Scenario Runner and CI Hooks
Owner: qa-automation

Acceptance Criteria
- Given `--scenario vertical_slice --seed 123 --capture_dir <dir>`, When the game runs headlessly, Then the runner loads Fae’s house, walks to town, interacts with 2 NPCs, 1 sign, 1 container, triggers a visible enemy, completes one battle turn, wins, returns to exploration, and exits.
- Given the scenario runs twice with the same seed, When capture artifacts are produced, Then outputs are byte-identical.

File paths
- `tools/ci/run-smoke.sh`
- `tools/ci/run-tests.sh`
- `tools/ci/run-scenario.sh`
- `game/scripts/testing/scenario_runner.gd`
- `game/data/scenarios/vertical_slice.tres`
- `docs/testing/scenario-runner.md`
- `docs/testing/strategy.md`
- `docs/testing/visual-regression.md`
