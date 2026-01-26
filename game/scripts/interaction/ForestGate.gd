extends Area2D
## ForestGate - Blocks passage until forest_unlocked story flag is set
## Player must complete the chaos quest chain to unlock

@export var required_flag: String = "forest_unlocked"
@export var locked_dialogue: String = "The path into the forest is blocked by thick vines. You'll need to find another way..."
@export var unlocked_dialogue: String = "The path is clear. The forest awaits!"
@export var target_area: String = ""
@export var target_spawn_id: String = "default"

var _is_unlocked: bool = false

func _ready() -> void:
	_check_unlock_status()
	if InventoryManager:
		# This might need a custom signal; for now check on interact
		pass

func _check_unlock_status() -> void:
	_is_unlocked = InventoryManager.has_story_flag(required_flag)

func interact() -> void:
	_check_unlock_status()
	
	if _is_unlocked:
		DialogueManager.show_dialogue(unlocked_dialogue)
		await DialogueManager.dialogue_finished
		
		# Transition to forest if target is set
		if target_area != "":
			SceneRouter.change_area(target_area, target_spawn_id)
	else:
		DialogueManager.show_dialogue(locked_dialogue)
