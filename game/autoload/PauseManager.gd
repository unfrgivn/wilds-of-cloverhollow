extends Node

## PauseManager - Handles game pause state and pause menu

signal pause_state_changed(is_paused: bool)

var _is_paused: bool = false
var _pause_menu: Node = null
var _pause_menu_scene: PackedScene = preload("res://game/scenes/ui/PauseMenuUI.tscn")

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	print("[PauseManager] Ready")

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		# Don't pause during battles or when other UI is open
		if BattleManager.is_in_battle():
			return
		if DialogueManager.is_dialogue_showing():
			return
		
		toggle_pause()
		get_viewport().set_input_as_handled()

func toggle_pause() -> void:
	if _is_paused:
		unpause_game()
	else:
		pause_game()

func pause_game() -> void:
	if _is_paused:
		return
	
	_is_paused = true
	get_tree().paused = true
	_show_pause_menu()
	pause_state_changed.emit(true)
	print("[PauseManager] Game paused")

func unpause_game() -> void:
	if not _is_paused:
		return
	
	_is_paused = false
	get_tree().paused = false
	_hide_pause_menu()
	pause_state_changed.emit(false)
	print("[PauseManager] Game unpaused")

func is_paused() -> bool:
	return _is_paused

func _show_pause_menu() -> void:
	if _pause_menu != null:
		return
	
	_pause_menu = _pause_menu_scene.instantiate()
	get_tree().root.add_child(_pause_menu)
	_pause_menu.open_menu()

func _hide_pause_menu() -> void:
	if _pause_menu == null:
		return
	
	_pause_menu.close_menu()
	_pause_menu.queue_free()
	_pause_menu = null
