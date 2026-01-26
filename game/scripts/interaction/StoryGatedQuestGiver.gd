extends Area2D
## StoryGatedQuestGiver - Quest giver that only appears/works when a story flag is set

signal interaction_started
signal interaction_ended

## Required story flag to show/enable this quest giver
@export var required_flag: String = ""

## Quest configuration
@export var quest_id: String = ""
@export var dialogue_offer: String = ""
@export var dialogue_accepted: String = ""
@export var dialogue_in_progress: String = ""
@export var dialogue_ready_to_complete: String = ""
@export var dialogue_completed: String = ""
@export var completion_check_flag: String = ""

func _ready() -> void:
	# Check if should be visible
	_update_visibility()
	InventoryManager.story_flag_changed.connect(_on_story_flag_changed)

func _update_visibility() -> void:
	if required_flag.is_empty():
		visible = true
		return
	visible = InventoryManager.has_story_flag(required_flag)

func _on_story_flag_changed(_flag: String, _value: bool) -> void:
	_update_visibility()

func interact() -> void:
	# Double-check flag requirement
	if not required_flag.is_empty() and not InventoryManager.has_story_flag(required_flag):
		return
	
	interaction_started.emit()
	
	# Quest already completed
	if QuestManager.is_quest_completed(quest_id):
		DialogueManager.show_dialogue(dialogue_completed)
		interaction_ended.emit()
		return
	
	# Quest is active
	if QuestManager.is_quest_active(quest_id):
		# Check if can complete
		if completion_check_flag.is_empty() or InventoryManager.has_story_flag(completion_check_flag):
			DialogueManager.show_dialogue(dialogue_ready_to_complete)
			# Complete all objectives
			var quest_data = GameData.get_quest(quest_id)
			if quest_data:
				for i in range(quest_data.objectives.size()):
					QuestManager.complete_objective(quest_id, i)
		else:
			DialogueManager.show_dialogue(dialogue_in_progress)
		interaction_ended.emit()
		return
	
	# Offer quest
	DialogueManager.show_dialogue(dialogue_offer)
	await get_tree().create_timer(0.1).timeout
	QuestManager.start_quest(quest_id)
	DialogueManager.show_dialogue(dialogue_accepted)
	interaction_ended.emit()

func end_interaction() -> void:
	interaction_ended.emit()
