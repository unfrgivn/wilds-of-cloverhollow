class_name BerryPickup
extends Area2D

## Berry collectible for the gather_berries quest

@export var berry_id: int = 1  # 1, 2, or 3 to track unique berries

var _collected: bool = false


func _ready() -> void:
	add_to_group("interactable")
	
	# Hide if already collected
	var flag_name := "berry_%d_collected" % berry_id
	if InventoryManager.has_story_flag(flag_name):
		queue_free()


func interact() -> void:
	if _collected:
		return
	_collected = true
	
	# Add berry to inventory
	InventoryManager.add_item("berry", 1)
	
	# Set collection flag
	var flag_name := "berry_%d_collected" % berry_id
	InventoryManager.set_story_flag(flag_name, true)
	
	# Count collected berries
	var count := 0
	for i in range(1, 4):
		if InventoryManager.has_story_flag("berry_%d_collected" % i):
			count += 1
	
	# Show dialogue
	DialogueManager.show_dialogue("Found a berry! (%d/3)" % count)
	await DialogueManager.dialogue_hidden
	
	# If all 3 collected, set the completion flag and mark objective done
	if count >= 3:
		InventoryManager.set_story_flag("has_all_berries", true)
		if QuestManager.is_quest_active("gather_berries"):
			QuestManager.complete_objective("gather_berries", 0)
		DialogueManager.show_dialogue("That's all 3 berries! Time to deliver them to the baker.")
		await DialogueManager.dialogue_hidden
	
	# Remove from scene
	queue_free()


func get_interaction_hint() -> String:
	return "Pick berry"
