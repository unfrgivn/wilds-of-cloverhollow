class_name QuestGiverNPC
extends Area2D

## NPC that can give and track quest completion
## Different dialogue based on quest state

@export var npc_name: String = "NPC"
@export var quest_id: String = ""
@export var dialogue_offer: String = "I have a task for you..."
@export var dialogue_accepted: String = "Good luck!"
@export var dialogue_in_progress: String = "How's the quest going?"
@export var dialogue_ready_to_complete: String = "You did it! Here's your reward."
@export var dialogue_completed: String = "Thanks again for your help!"
@export var completion_check_flag: String = ""  # Story flag that means player can complete

var _interacted: bool = false


func _ready() -> void:
	add_to_group("interactable")


func interact() -> void:
	if _interacted:
		return
	_interacted = true
	
	var dialogue_to_show: String = ""
	var should_start_quest := false
	var should_complete_quest := false
	
	if quest_id.is_empty():
		dialogue_to_show = dialogue_offer
	elif QuestManager.is_quest_completed(quest_id):
		dialogue_to_show = dialogue_completed
	elif QuestManager.is_quest_active(quest_id):
		# Check if ready to complete
		if not completion_check_flag.is_empty() and InventoryManager.has_story_flag(completion_check_flag):
			dialogue_to_show = dialogue_ready_to_complete
			should_complete_quest = true
		else:
			dialogue_to_show = dialogue_in_progress
	else:
		# Quest not started - offer it
		dialogue_to_show = dialogue_offer
		should_start_quest = true
	
	DialogueManager.show_dialogue(dialogue_to_show)
	await DialogueManager.dialogue_hidden
	
	if should_start_quest:
		QuestManager.start_quest(quest_id)
		DialogueManager.show_dialogue(dialogue_accepted)
		await DialogueManager.dialogue_hidden
	elif should_complete_quest:
		QuestManager.complete_quest(quest_id)
		# Clear the completion flag
		if not completion_check_flag.is_empty():
			InventoryManager.set_story_flag(completion_check_flag, false)
	
	_interacted = false


func get_interaction_hint() -> String:
	return "Talk to " + npc_name
