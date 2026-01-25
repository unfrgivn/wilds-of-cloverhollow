extends Area2D
## ToolGatedInteractable - An interactable that requires a specific tool to use
## Shows different dialogue if player doesn't have the required tool

@export var required_tool: String = ""
@export var dialogue_without_tool: String = "You need something to proceed here..."
@export var dialogue_with_tool: String = "You used the tool!"
@export var one_time_use: bool = false

signal tool_interaction_started(tool_id: String)
signal tool_interaction_completed(tool_id: String)

var _used: bool = false

func _ready() -> void:
	pass

func interact() -> void:
	if _used and one_time_use:
		return
	
	if required_tool == "" or InventoryManager.has_tool(required_tool):
		# Player has the tool
		DialogueManager.show_dialogue(dialogue_with_tool)
		tool_interaction_started.emit(required_tool)
		if one_time_use:
			_used = true
		await DialogueManager.dialogue_finished
		tool_interaction_completed.emit(required_tool)
	else:
		# Player doesn't have the tool
		DialogueManager.show_dialogue(dialogue_without_tool)
