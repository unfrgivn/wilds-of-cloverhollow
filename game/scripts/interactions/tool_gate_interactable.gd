class_name ToolGateInteractable
extends "res://game/scripts/interactions/interactable.gd"

const DialogueLine = preload("res://game/scripts/ui/dialogue_line.gd")

@export var required_tool: String = "shovel"
@export var consume_tool: bool = false
@export var unlock_flag: String = ""
@export var quest_id: String = ""
@export var quest_step_delta: int = 1
@export var speaker_name: String = ""
@export_multiline var locked_message: String = "It's stuck tight."
@export_multiline var unlock_message: String = "You pry it open!"

@onready var _game_state = get_node("/root/GameState")
@onready var _dialogue_manager = get_node_or_null("/root/DialogueManager")
@onready var _quest_log = get_node_or_null("/root/QuestLog")


func interact(_interactor: Node) -> void:
	if required_tool.is_empty():
		_unlock_gate()
		return
	if _game_state.has_item(required_tool):
		if consume_tool:
			_game_state.remove_item(required_tool, 1)
		_unlock_gate()
		return
	_show_line(locked_message)


func _unlock_gate() -> void:
	if not unlock_flag.is_empty():
		_game_state.set_flag(unlock_flag, true)
	_show_line(unlock_message)
	if _quest_log != null and not quest_id.is_empty():
		_quest_log.advance_quest(quest_id, quest_step_delta)
	queue_free()


func _show_line(message: String) -> void:
	if _dialogue_manager == null:
		return
	var line = DialogueLine.new()
	line.speaker_name = speaker_name
	line.text = message
	var lines: Array[DialogueLine] = [line]
	_dialogue_manager.start_dialogue(lines)
