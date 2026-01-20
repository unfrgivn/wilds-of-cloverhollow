extends Node

const OVERLAY_SCENE = preload("res://game/scenes/ui/ControlsOverlay.tscn")

var _overlay_instance: CanvasLayer = null
var _game_state

func _ready() -> void:
	_game_state = get_node_or_null("/root/GameState")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_toggle_overlay()
		get_viewport().set_input_as_handled()

func _toggle_overlay() -> void:
	if _overlay_instance == null:
		_open_overlay()
	else:
		_close_overlay()

func _open_overlay() -> void:
	if _overlay_instance != null:
		return
	_overlay_instance = OVERLAY_SCENE.instantiate()
	get_tree().root.add_child(_overlay_instance)
	if _game_state != null:
		_game_state.input_blocked = true

func _close_overlay() -> void:
	if _overlay_instance == null:
		return
	_overlay_instance.queue_free()
	_overlay_instance = null
	if _game_state != null:
		_game_state.input_blocked = false
