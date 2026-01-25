extends Area2D
## ItemPickup - A collectible that gives the player a tool or item when interacted

@export var pickup_type: String = "tool"  # "tool" or "item"
@export var pickup_id: String = ""
@export var pickup_count: int = 1
@export var dialogue_text: String = "You found something!"
@export var disappear_after_pickup: bool = true

signal pickup_collected(pickup_id: String)

var _collected: bool = false

func _ready() -> void:
	pass

func interact() -> void:
	if _collected:
		return
	
	if pickup_id == "":
		push_warning("[ItemPickup] No pickup_id set!")
		return
	
	if pickup_type == "tool":
		InventoryManager.acquire_tool(pickup_id)
	elif pickup_type == "item":
		InventoryManager.add_item(pickup_id, pickup_count)
	
	_collected = true
	pickup_collected.emit(pickup_id)
	
	DialogueManager.show_dialogue(dialogue_text)
	
	if disappear_after_pickup:
		await DialogueManager.dialogue_finished
		queue_free()
