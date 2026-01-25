extends Node
## BattleManager - handles battle transitions and state

signal battle_started(enemy_data: Dictionary)
signal battle_ended(result: String)

## Path to the battle scene
const BATTLE_SCENE_PATH := "res://game/scenes/battle/BattleScene.tscn"

## Current battle data
var current_enemy_data: Dictionary = {}
## Scene to return to after battle
var _return_scene_path: String = ""
## Spawn marker to use when returning
var _return_spawn_id: String = "default"
## Whether a battle is currently active
var in_battle: bool = false

func _ready() -> void:
	pass

## Start a battle with the given enemy data
## enemy_data should include at minimum: { "enemy_id": String }
func start_battle(enemy_data: Dictionary = {}) -> void:
	if in_battle:
		push_warning("BattleManager: Already in battle, ignoring start_battle call")
		return
	
	in_battle = true
	current_enemy_data = enemy_data
	
	# Store current scene for return
	var current_scene := get_tree().current_scene
	if current_scene != null and current_scene.scene_file_path != "":
		_return_scene_path = current_scene.scene_file_path
	
	battle_started.emit(enemy_data)
	
	# Transition to battle scene
	var result := get_tree().change_scene_to_file(BATTLE_SCENE_PATH)
	if result != OK:
		push_error("BattleManager: Failed to load battle scene")
		in_battle = false
		return
	
	print("[BattleManager] Battle started with: %s" % str(enemy_data))

## End the current battle with a result
## result: "victory", "defeat", "flee"
func end_battle(result: String = "victory") -> void:
	if not in_battle:
		push_warning("BattleManager: No battle active, ignoring end_battle call")
		return
	
	in_battle = false
	battle_ended.emit(result)
	
	print("[BattleManager] Battle ended: %s" % result)
	
	# Return to overworld
	if _return_scene_path != "":
		SceneRouter.go_to_area(_return_scene_path, _return_spawn_id)
	
	current_enemy_data = {}
	_return_scene_path = ""
	_return_spawn_id = "default"
