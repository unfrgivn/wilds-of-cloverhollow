extends Interactable
class_name ContainerInteractable
## A container that gives items once, then becomes empty

@export var container_id: String = ""
@export var item_id: String = ""
@export var item_count: int = 1
@export var opened_text: String = "It's empty."
@export var loot_text: String = "Found {item}!"

var _is_looted: bool = false

func _ready() -> void:
	if container_id.is_empty():
		container_id = str(get_instance_id())
	_is_looted = GameState.is_container_looted(container_id)

func get_interaction_prompt() -> String:
	return "Open"

func interact(_actor: Node) -> void:
	interaction_started.emit()
	
	if _is_looted:
		UIRoot.show_dialogue([opened_text])
	else:
		_is_looted = true
		GameState.mark_container_looted(container_id)
		GameState.add_item(item_id, item_count)
		var text := loot_text.replace("{item}", item_id)
		UIRoot.show_dialogue([text])
	
	await UIRoot.dialogue_finished
	interaction_finished.emit()

func can_interact() -> bool:
	return true
