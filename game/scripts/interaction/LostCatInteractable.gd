class_name LostCatInteractable
extends Area2D

## Lost cat collectible - sets story flag when found

@export var dialogue_found: String = "Meow! You found Whiskers!"
@export var completion_flag: String = "found_mayors_cat"

var _found: bool = false


func _ready() -> void:
	add_to_group("interactable")
	
	# Hide if already found
	if InventoryManager.has_story_flag(completion_flag):
		queue_free()


func interact() -> void:
	if _found:
		return
	_found = true
	
	# Show dialogue
	DialogueManager.show_dialogue(dialogue_found)
	await DialogueManager.dialogue_hidden
	
	DialogueManager.show_dialogue("Whiskers seems happy to see you! Let's take her back to the Mayor.")
	await DialogueManager.dialogue_hidden
	
	# Set the flag
	InventoryManager.set_story_flag(completion_flag, true)
	
	# Complete first objective of quest
	if QuestManager.is_quest_active("find_mayors_cat"):
		QuestManager.complete_objective("find_mayors_cat", 0)
	
	# Remove the cat from the scene
	queue_free()


func get_interaction_hint() -> String:
	return "Check the cat"
