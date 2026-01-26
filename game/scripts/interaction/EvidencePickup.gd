extends Area2D
## EvidencePickup - Collectible evidence item for quest progression
## Tracks which evidence has been found via story flags

@export var evidence_id: String = ""
@export var evidence_name: String = "Evidence"
@export var pickup_dialogue: String = "You found some evidence!"
@export var already_collected_dialogue: String = "You've already collected this."
@export var quest_id: String = "chaos_gather_evidence"
@export var objective_index: int = 0

var _collected: bool = false

func _ready() -> void:
	# Check if already collected
	var flag_name = "evidence_" + evidence_id + "_collected"
	_collected = InventoryManager.has_story_flag(flag_name)
	
	if _collected:
		# Hide the evidence if already collected
		visible = false
		set_deferred("monitoring", false)

func interact() -> void:
	if _collected:
		DialogueManager.show_dialogue(already_collected_dialogue)
		return
	
	# Mark as collected
	var flag_name = "evidence_" + evidence_id + "_collected"
	InventoryManager.set_story_flag(flag_name)
	_collected = true
	
	# Show pickup dialogue
	DialogueManager.show_dialogue(pickup_dialogue)
	await DialogueManager.dialogue_finished
	
	# Complete quest objective if quest is active
	if quest_id != "" and QuestManager.is_quest_active(quest_id):
		QuestManager.complete_objective(quest_id, objective_index)
	
	# Hide the pickup
	visible = false
	set_deferred("monitoring", false)
