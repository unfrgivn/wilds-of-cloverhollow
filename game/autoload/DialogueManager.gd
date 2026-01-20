extends Node

const DialogueLine = preload("res://game/scripts/ui/dialogue_line.gd")

signal dialogue_started
signal dialogue_finished
signal line_started(line: DialogueLine)
signal line_finished(line: DialogueLine)

var _queue: Array[DialogueLine] = []
var is_active: bool = false
var _dialogue_box_scene: PackedScene = preload("res://game/scenes/ui/DialogueBox.tscn")
var _dialogue_box_instance: Node = null
@onready var _game_state = get_node("/root/GameState")

func start_dialogue(lines: Array[DialogueLine]) -> void:
	if is_active: return
	if lines.is_empty(): return
	
	is_active = true
	_queue = lines.duplicate()
	
	_game_state.input_blocked = true
	dialogue_started.emit()
	
	_ensure_dialogue_box()
	_dialogue_box_instance.show()
	_show_next_line()

func _ensure_dialogue_box() -> void:
	if not is_instance_valid(_dialogue_box_instance):
		_dialogue_box_instance = _dialogue_box_scene.instantiate()
		get_tree().root.add_child(_dialogue_box_instance)

func _show_next_line() -> void:
	if _queue.is_empty():
		_finish_dialogue()
		return
	
	var line = _queue.pop_front()
	line_started.emit(line)
	_dialogue_box_instance.display_line(line)

func advance() -> void:
	# Called by the DialogueBox when user confirms/taps
	_show_next_line()

func _finish_dialogue() -> void:
	is_active = false
	_game_state.input_blocked = false
	if is_instance_valid(_dialogue_box_instance):
		_dialogue_box_instance.hide()
	dialogue_finished.emit()
