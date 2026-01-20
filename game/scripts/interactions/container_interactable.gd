extends "res://game/scripts/interactions/interactable.gd"

const DialogueLine = preload("res://game/scripts/ui/dialogue_line.gd")

@export var flag_key: String = "container_opened"
@export var item_id: String = ""
@export var quantity: int = 1
@export_multiline var opened_text: String = "You found something."
@export_multiline var empty_text: String = "It's empty."
@export var speaker_name: String = ""

@onready var _game_state = get_node("/root/GameState")
@onready var _dialogue_manager = get_node("/root/DialogueManager")

func interact(_interactor: Node) -> void:
	if _game_state.get_flag(flag_key):
		_show_line(empty_text)
		return

	_game_state.set_flag(flag_key, true)
	if not item_id.is_empty():
		_game_state.add_item(item_id, quantity)
	_show_line(opened_text)

func _show_line(message: String) -> void:
	var line = DialogueLine.new()
	line.speaker_name = speaker_name
	line.text = message
	var lines: Array[DialogueLine] = [line]
	_dialogue_manager.start_dialogue(lines)
