extends Node

const MENU_SCENE = preload("res://game/scenes/ui/InventoryMenu.tscn")

var _menu_instance: Control = null
var _game_state

func _ready() -> void:
	_game_state = get_node("/root/GameState")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_menu"):
		toggle_menu()

func toggle_menu() -> void:
	if _menu_instance == null:
		open_menu()
	else:
		close_menu()

func open_menu() -> void:
	if _menu_instance != null:
		return
	
	_menu_instance = MENU_SCENE.instantiate()
	get_tree().root.add_child(_menu_instance)
	
	# Connect close signal
	if _menu_instance.has_signal("close_requested"):
		_menu_instance.close_requested.connect(close_menu)
	
	_game_state.input_blocked = true

func close_menu() -> void:
	if _menu_instance == null:
		return
	
	_menu_instance.queue_free()
	_menu_instance = null
	
	_game_state.input_blocked = false
