extends Area2D
## BrokenFountain - Tool-gated puzzle interaction for fixing the town fountain

signal interaction_started
signal interaction_ended

@export var required_tool: String = "wrench"
@export var quest_id: String = "fix_fountain"

## Dialogue options
var dialogue_broken: String = "The town fountain is broken! Water is leaking everywhere. If only someone had a wrench to tighten the pipes..."
var dialogue_fixing: String = "You use the wrench to tighten the loose pipes. After a few turns... SPLASH! The fountain springs back to life!"
var dialogue_fixed: String = "The fountain is working beautifully again. The townspeople will be so happy!"

var _is_fixed: bool = false

func _ready() -> void:
	# Check if already fixed
	if InventoryManager.has_story_flag("fountain_fixed"):
		_is_fixed = true

func interact() -> void:
	interaction_started.emit()
	
	if _is_fixed:
		DialogueManager.show_dialogue(dialogue_fixed)
		interaction_ended.emit()
		return
	
	# Check for tool
	if not InventoryManager.has_tool(required_tool):
		DialogueManager.show_dialogue(dialogue_broken)
		
		# Start the quest if not already active
		if not QuestManager.is_quest_active(quest_id) and not QuestManager.is_quest_completed(quest_id):
			QuestManager.start_quest(quest_id)
			print("[BrokenFountain] Started fix_fountain quest")
		
		interaction_ended.emit()
		return
	
	# Has wrench - fix the fountain!
	DialogueManager.show_dialogue(dialogue_fixing)
	await get_tree().create_timer(0.1).timeout
	
	_is_fixed = true
	InventoryManager.set_story_flag("fountain_fixed", true)
	print("[BrokenFountain] Fountain fixed!")
	
	# Complete quest objectives
	if QuestManager.is_quest_active(quest_id):
		QuestManager.complete_objective(quest_id, 1)  # Repair the fountain
		print("[BrokenFountain] Quest objectives completed")
	
	DialogueManager.show_dialogue(dialogue_fixed)
	interaction_ended.emit()

func end_interaction() -> void:
	interaction_ended.emit()
