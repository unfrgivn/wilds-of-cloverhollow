class_name QuestNPCInteractable
extends Interactable

@export var quest_id: String = ""
@export var speaker_name: String = "Villager"
@export_multiline var intro_text: String = "Hey there!"
@export_multiline var in_progress_text: String = "Any luck yet?"
@export_multiline var completed_text: String = "Thanks for your help!"
@export var advance_step_on_talk: bool = false
@export var reward_item_id: String = ""
@export var reward_quantity: int = 1
@export var reward_flag: String = ""
@export var start_item_id: String = ""
@export var start_item_quantity: int = 1

@onready var _dialogue_manager = get_node("/root/DialogueManager")
@onready var _quest_log = get_node_or_null("/root/QuestLog")
@onready var _game_state = get_node("/root/GameState")


func interact(_interactor: Node) -> void:
	if quest_id.is_empty() or _quest_log == null:
		_show_line(intro_text)
		return
	if _quest_log.is_completed(quest_id):
		_grant_reward()
		_show_line(completed_text)
		return
	if not _quest_log.is_active(quest_id):
		_quest_log.start_quest(quest_id)
		_grant_start_item()
		if advance_step_on_talk:
			_quest_log.advance_quest(quest_id, 1)
		_show_line(intro_text)
		return

	if advance_step_on_talk:
		_quest_log.advance_quest(quest_id, 1)
		if _quest_log.is_completed(quest_id):
			_grant_reward()
			_show_line(completed_text)
			return
	_show_line(in_progress_text)


func _grant_start_item() -> void:
	if start_item_id.is_empty():
		return
	_game_state.add_item(start_item_id, start_item_quantity)


func _grant_reward() -> void:
	var reward_key = _get_reward_flag()
	if not reward_key.is_empty() and _game_state.get_flag(reward_key):
		return
	if not reward_item_id.is_empty():
		_game_state.add_item(reward_item_id, reward_quantity)
	if not reward_key.is_empty():
		_game_state.set_flag(reward_key, true)


func _get_reward_flag() -> String:
	if not reward_flag.is_empty():
		return reward_flag
	if quest_id.is_empty():
		return ""
	return "quest_reward_%s" % quest_id


func _show_line(message: String) -> void:
	if _dialogue_manager == null:
		return
	var line = DialogueLine.new()
	line.speaker_name = speaker_name
	line.text = message
	var lines: Array[DialogueLine] = [line]
	_dialogue_manager.start_dialogue(lines)
