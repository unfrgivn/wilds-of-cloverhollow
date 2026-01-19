extends Node2D

@export var return_scene := ""
@export var auto_finish_frames := 60

var _frames := 0
var _awaiting_command := true

@onready var _game_state = get_node("/root/GameState")
@onready var _status_label: Label = $CanvasLayer/StatusLabel

func _ready() -> void:
	if return_scene.is_empty() and _game_state != null:
		return_scene = String(_game_state.get_value("return_scene", ""))
	if _game_state != null:
		_game_state.input_blocked = true
		_game_state.set_value("battle_turn_complete", false)
	_update_status("Awaiting command")

func _process(_delta: float) -> void:
	_frames += 1
	if not _awaiting_command and _frames >= auto_finish_frames:
		_finish_battle()

func select_battle_command(command_id: String) -> void:
	if not _awaiting_command:
		return
	_awaiting_command = false
	if _game_state != null:
		_game_state.set_value("battle_command", command_id)
	_update_status("Command: %s" % command_id)

func _finish_battle() -> void:
	if _game_state != null:
		_game_state.input_blocked = false
		_game_state.set_value("battle_turn_complete", true)
	var encounter_manager = get_node_or_null("/root/EncounterManager")
	if encounter_manager != null and encounter_manager.has_method("finish_encounter"):
		encounter_manager.finish_encounter("victory")
	if return_scene.is_empty():
		get_tree().quit()
		return
	get_tree().change_scene_to_file(return_scene)

func _update_status(text: String) -> void:
	if _status_label != null:
		_status_label.text = text
