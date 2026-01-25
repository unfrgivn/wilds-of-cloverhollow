extends Area2D
## StoryGatedInteractable - An interactable gated by story flags
## Perfect for "need hall pass" or "must talk to teacher first" type puzzles

@export var required_flag: String = ""
@export var dialogue_without_flag: String = "You can't do this yet..."
@export var dialogue_with_flag: String = "Success!"
@export var grants_flag: String = ""
@export var one_time_use: bool = false

signal story_interaction_started(flag: String)
signal story_interaction_completed(flag: String)

var _used: bool = false

func _ready() -> void:
	pass

func interact() -> void:
	if _used and one_time_use:
		return
	
	# Check if player has the required story flag (or no flag required)
	var can_proceed: bool = required_flag == "" or InventoryManager.has_story_flag(required_flag)
	
	if can_proceed:
		story_interaction_started.emit(required_flag)
		DialogueManager.show_dialogue(dialogue_with_flag)
		
		# Grant a new flag if configured
		if grants_flag != "":
			InventoryManager.set_story_flag(grants_flag)
		
		if one_time_use:
			_used = true
		
		await DialogueManager.dialogue_finished
		story_interaction_completed.emit(required_flag)
	else:
		DialogueManager.show_dialogue(dialogue_without_flag)
