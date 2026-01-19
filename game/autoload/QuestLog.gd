extends Node

signal quest_started(quest_id: String)
signal quest_step_advanced(quest_id: String, step: int)
signal quest_completed(quest_id: String)

@onready var _game_state = get_node("/root/GameState")
@onready var _data_registry = get_node("/root/DataRegistry")


func configure(game_state: Node, data_registry: Node) -> void:
	_game_state = game_state
	_data_registry = data_registry


func start_quest(quest_id: String) -> bool:
	if not _dependencies_ready():
		return false
	if quest_id.is_empty():
		return false
	var quest = _data_registry.get_quest(quest_id)
	if quest == null:
		return false
	if _game_state.quests.has(quest_id):
		return false
	if _is_flagged_complete(quest):
		_set_state(quest_id, _completed_state_for(quest))
		return false
	_set_state(quest_id, {"step": 0, "completed": false})
	quest_started.emit(quest_id)
	return true


func advance_quest(quest_id: String, steps: int = 1) -> bool:
	if not _dependencies_ready():
		return false
	var quest = _data_registry.get_quest(quest_id)
	if quest == null:
		return false
	var state = _get_state(quest_id)
	if state.is_empty():
		return false
	if bool(state.get("completed", false)):
		return false
	var current_step = int(state.get("step", 0))
	var step_count = quest.steps.size()
	var next_step = current_step + max(steps, 1)
	if step_count == 0 or next_step >= step_count:
		return _complete_quest(quest_id, quest)
	state["step"] = next_step
	_set_state(quest_id, state)
	quest_step_advanced.emit(quest_id, next_step)
	return true


func complete_quest(quest_id: String) -> bool:
	if not _dependencies_ready():
		return false
	var quest = _data_registry.get_quest(quest_id)
	if quest == null:
		return false
	var state = _get_state(quest_id)
	if state.is_empty():
		return false
	if bool(state.get("completed", false)):
		return false
	return _complete_quest(quest_id, quest)


func is_active(quest_id: String) -> bool:
	if not _dependencies_ready():
		return false
	var state = _get_state(quest_id)
	return not state.is_empty() and not bool(state.get("completed", false))


func is_completed(quest_id: String) -> bool:
	if not _dependencies_ready():
		return false
	var quest = _data_registry.get_quest(quest_id)
	if quest == null:
		return false
	if _is_flagged_complete(quest):
		return true
	var state = _get_state(quest_id)
	return not state.is_empty() and bool(state.get("completed", false))


func get_current_step(quest_id: String) -> int:
	if not _dependencies_ready():
		return -1
	var state = _get_state(quest_id)
	if state.is_empty():
		return -1
	return int(state.get("step", 0))


func get_step_text(quest_id: String) -> String:
	if not _dependencies_ready():
		return ""
	var quest = _data_registry.get_quest(quest_id)
	if quest == null:
		return ""
	var step_index = get_current_step(quest_id)
	if step_index < 0 or step_index >= quest.steps.size():
		return ""
	return quest.steps[step_index]


func reset() -> void:
	if not _dependencies_ready():
		return
	_game_state.quests = {}


func _get_state(quest_id: String) -> Dictionary:
	if _game_state == null:
		return {}
	return _game_state.quests.get(quest_id, {}).duplicate()


func _set_state(quest_id: String, state: Dictionary) -> void:
	if _game_state == null:
		return
	_game_state.quests[quest_id] = state.duplicate()


func _complete_quest(quest_id: String, quest: Resource) -> bool:
	var step_count = quest.steps.size()
	var final_step = max(step_count - 1, 0)
	_set_state(quest_id, {"step": final_step, "completed": true})
	_game_state.set_flag(_get_completion_flag(quest), true)
	quest_completed.emit(quest_id)
	return true


func _get_completion_flag(quest: Resource) -> String:
	if not String(quest.completion_flag).is_empty():
		return quest.completion_flag
	return "quest_completed_%s" % String(quest.id)


func _is_flagged_complete(quest: Resource) -> bool:
	return _game_state.get_flag(_get_completion_flag(quest))


func _completed_state_for(quest: Resource) -> Dictionary:
	var step_count = quest.steps.size()
	var final_step = max(step_count - 1, 0)
	return {"step": final_step, "completed": true}


func _dependencies_ready() -> bool:
	return _game_state != null and _data_registry != null
