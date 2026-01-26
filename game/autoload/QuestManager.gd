extends Node

## QuestManager - Tracks active and completed quests
## Autoload singleton: QuestManager

signal quest_started(quest_id: String)
signal quest_completed(quest_id: String)
signal quest_failed(quest_id: String)
signal objective_updated(quest_id: String, objective_index: int, completed: bool)

## Active quests: {quest_id: {quest_data, objective_status[]}}
var _active_quests: Dictionary = {}
## Completed quest IDs
var _completed_quests: Array[String] = []
## Failed quest IDs
var _failed_quests: Array[String] = []


func _ready() -> void:
	print("[QuestManager] Initialized")


## Start a quest by ID - fetches data from GameData
func start_quest(quest_id: String) -> bool:
	if _active_quests.has(quest_id):
		print("[QuestManager] Quest already active: %s" % quest_id)
		return false
	if quest_id in _completed_quests:
		print("[QuestManager] Quest already completed: %s" % quest_id)
		return false
	
	var quest_data := GameData.get_quest(quest_id)
	if quest_data.is_empty():
		print("[QuestManager] Quest not found: %s" % quest_id)
		return false
	
	var objectives: Array = quest_data.get("objectives", [])
	var objective_status: Array[bool] = []
	objective_status.resize(objectives.size())
	objective_status.fill(false)
	
	_active_quests[quest_id] = {
		"data": quest_data,
		"objective_status": objective_status
	}
	
	# Also set story flag for compatibility
	InventoryManager.set_story_flag("quest_accepted_" + quest_id, true)
	
	quest_started.emit(quest_id)
	print("[QuestManager] Quest started: %s" % quest_id)
	return true


## Complete a specific objective
func complete_objective(quest_id: String, objective_index: int) -> bool:
	if not _active_quests.has(quest_id):
		print("[QuestManager] Quest not active: %s" % quest_id)
		return false
	
	var quest := _active_quests[quest_id] as Dictionary
	var objective_status: Array = quest.get("objective_status", [])
	
	if objective_index < 0 or objective_index >= objective_status.size():
		print("[QuestManager] Invalid objective index: %d for quest %s" % [objective_index, quest_id])
		return false
	
	if objective_status[objective_index]:
		return true  # Already complete
	
	objective_status[objective_index] = true
	objective_updated.emit(quest_id, objective_index, true)
	print("[QuestManager] Objective %d completed for quest: %s" % [objective_index, quest_id])
	
	# Check if all objectives complete
	var all_complete := true
	for status in objective_status:
		if not status:
			all_complete = false
			break
	
	if all_complete:
		complete_quest(quest_id)
	
	return true


## Complete a quest
func complete_quest(quest_id: String) -> bool:
	if not _active_quests.has(quest_id):
		print("[QuestManager] Quest not active: %s" % quest_id)
		return false
	
	var quest := _active_quests[quest_id] as Dictionary
	var quest_data: Dictionary = quest.get("data", {})
	
	# Set completion flag
	var completion_flag: String = quest_data.get("completion_flag", "")
	if not completion_flag.is_empty():
		InventoryManager.set_story_flag(completion_flag, true)
	
	# Grant rewards
	var reward_gold: int = quest_data.get("reward_gold", 0)
	if reward_gold > 0:
		# TODO: Add gold to inventory when gold system exists
		print("[QuestManager] Rewarded %d gold" % reward_gold)
	
	var reward_items: Array = quest_data.get("reward_items", [])
	for item_id in reward_items:
		InventoryManager.add_item(item_id, 1)
		print("[QuestManager] Rewarded item: %s" % item_id)
	
	# Move to completed
	_active_quests.erase(quest_id)
	_completed_quests.append(quest_id)
	
	quest_completed.emit(quest_id)
	print("[QuestManager] Quest completed: %s" % quest_id)
	return true


## Fail a quest
func fail_quest(quest_id: String) -> bool:
	if not _active_quests.has(quest_id):
		print("[QuestManager] Quest not active: %s" % quest_id)
		return false
	
	_active_quests.erase(quest_id)
	_failed_quests.append(quest_id)
	
	quest_failed.emit(quest_id)
	print("[QuestManager] Quest failed: %s" % quest_id)
	return true


## Check if a quest is active
func is_quest_active(quest_id: String) -> bool:
	return _active_quests.has(quest_id)


## Check if a quest is completed
func is_quest_completed(quest_id: String) -> bool:
	return quest_id in _completed_quests


## Check if an objective is completed
func is_objective_completed(quest_id: String, objective_index: int) -> bool:
	if not _active_quests.has(quest_id):
		return false
	
	var quest := _active_quests[quest_id] as Dictionary
	var objective_status: Array = quest.get("objective_status", [])
	
	if objective_index < 0 or objective_index >= objective_status.size():
		return false
	
	return objective_status[objective_index]


## Get all active quests
func get_active_quests() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for quest_id in _active_quests:
		var quest := _active_quests[quest_id] as Dictionary
		var data: Dictionary = quest.get("data", {}).duplicate()
		data["objective_status"] = quest.get("objective_status", [])
		result.append(data)
	return result


## Get all completed quest IDs
func get_completed_quest_ids() -> Array[String]:
	return _completed_quests.duplicate()


## Get count of active quests
func get_active_quest_count() -> int:
	return _active_quests.size()


## Clear all quest state (for new game)
func reset() -> void:
	_active_quests.clear()
	_completed_quests.clear()
	_failed_quests.clear()
	print("[QuestManager] Reset")


## Save quest state to dictionary
func get_save_data() -> Dictionary:
	var active_save: Dictionary = {}
	for quest_id in _active_quests:
		var quest := _active_quests[quest_id] as Dictionary
		active_save[quest_id] = quest.get("objective_status", [])
	
	return {
		"active": active_save,
		"completed": _completed_quests.duplicate(),
		"failed": _failed_quests.duplicate()
	}


## Load quest state from dictionary
func load_save_data(data: Dictionary) -> void:
	reset()
	
	var active_data: Dictionary = data.get("active", {})
	for quest_id in active_data:
		var quest_data := GameData.get_quest(quest_id)
		if quest_data.is_empty():
			continue
		
		var saved_status: Array = active_data[quest_id]
		var objective_status: Array[bool] = []
		for status in saved_status:
			objective_status.append(status)
		
		_active_quests[quest_id] = {
			"data": quest_data,
			"objective_status": objective_status
		}
	
	var completed_data: Array = data.get("completed", [])
	for quest_id in completed_data:
		_completed_quests.append(quest_id)
	
	var failed_data: Array = data.get("failed", [])
	for quest_id in failed_data:
		_failed_quests.append(quest_id)
	
	print("[QuestManager] Loaded %d active, %d completed, %d failed quests" % [
		_active_quests.size(), _completed_quests.size(), _failed_quests.size()
	])
