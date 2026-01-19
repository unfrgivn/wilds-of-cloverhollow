extends Node

signal encounter_started(encounter_id: String, battle_scene: String, return_scene: String)
signal encounter_finished(encounter_id: String, result: String)

@export var default_battle_scene := "res://game/scenes/battle/BattleScene.tscn"

var active := false
var current_encounter_id := ""
var current_battle_scene := ""
var current_return_scene := ""

@onready var _game_state = get_node_or_null("/root/GameState")


func start_encounter(battle_scene: String, return_scene: String = "", encounter_id: String = "", source: String = "") -> bool:
	if active:
		return false
	var resolved_battle = battle_scene
	if resolved_battle.is_empty():
		resolved_battle = default_battle_scene
	if resolved_battle.is_empty():
		push_error("EncounterManager missing battle scene")
		return false
	var resolved_return = return_scene
	if resolved_return.is_empty():
		var current_scene = get_tree().current_scene
		if current_scene != null:
			resolved_return = current_scene.scene_file_path
	if resolved_return.is_empty():
		push_error("EncounterManager missing return scene")
		return false

	active = true
	current_encounter_id = encounter_id
	current_battle_scene = resolved_battle
	current_return_scene = resolved_return

	if _game_state != null:
		_game_state.input_blocked = true
		_game_state.set_value("return_scene", resolved_return)
		_game_state.set_value("battle_scene", resolved_battle)
		_game_state.set_value("encounter_id", encounter_id)
		_game_state.set_value("encounter_source", source)
		_game_state.set_value("battle_started", true)

	encounter_started.emit(encounter_id, resolved_battle, resolved_return)
	get_tree().change_scene_to_file(resolved_battle)
	return true


func finish_encounter(result: String = "") -> void:
	if not active:
		return
	active = false
	if _game_state != null:
		_game_state.input_blocked = false
		_game_state.set_value("battle_result", result)
		_game_state.set_value("battle_started", false)
	encounter_finished.emit(current_encounter_id, result)
	current_encounter_id = ""
	current_battle_scene = ""
	current_return_scene = ""
