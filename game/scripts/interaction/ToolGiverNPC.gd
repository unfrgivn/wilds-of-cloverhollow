extends Area2D
## ToolGiverNPC - NPC that gives a tool and tracks quest progress

signal interaction_started
signal interaction_ended

@export var npc_name: String = ""
@export var tool_id: String = ""
@export var quest_id: String = ""

## Dialogue options
@export var dialogue_first_meeting: String = "Hello!"
@export var dialogue_give_tool: String = "Here, take this!"
@export var dialogue_already_have_tool: String = "You already have the tool!"

var _gave_tool: bool = false

func _ready() -> void:
	# Check if player already has the tool
	if InventoryManager.has_tool(tool_id):
		_gave_tool = true

func interact() -> void:
	interaction_started.emit()
	
	# Already has tool
	if InventoryManager.has_tool(tool_id):
		DialogueManager.show_dialogue(dialogue_already_have_tool)
		interaction_ended.emit()
		return
	
	# Give the tool
	DialogueManager.show_dialogue(dialogue_first_meeting)
	await get_tree().create_timer(0.1).timeout
	
	InventoryManager.acquire_tool(tool_id)
	_gave_tool = true
	print("[ToolGiverNPC] Gave tool: %s" % tool_id)
	
	# Complete quest objective if applicable
	if not quest_id.is_empty() and QuestManager.is_quest_active(quest_id):
		QuestManager.complete_objective(quest_id, 0)  # "Get tool" objective
		print("[ToolGiverNPC] Completed quest objective for %s" % quest_id)
	
	DialogueManager.show_dialogue(dialogue_give_tool)
	interaction_ended.emit()

func end_interaction() -> void:
	interaction_ended.emit()
