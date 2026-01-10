extends Node
## GameState - Global state management for inventory, flags, and counters

# Inventory: Dictionary of item_id -> quantity
var inventory: Dictionary = {}

# Quest flags: Dictionary of flag_name -> bool
var quest_flags: Dictionary = {}

# Counters (currency, collectibles, etc.)
var counters: Dictionary = {
	"candy": 0,
	"gems": 0
}

# Container states: tracks which containers have been looted
var looted_containers: Dictionary = {}


func _ready() -> void:
	pass


# --- Inventory Management ---

func add_item(item_id: String, quantity: int = 1) -> void:
	if inventory.has(item_id):
		inventory[item_id] += quantity
	else:
		inventory[item_id] = quantity
	print("[GameState] Added %d x %s" % [quantity, item_id])


func remove_item(item_id: String, quantity: int = 1) -> bool:
	if not inventory.has(item_id):
		return false
	if inventory[item_id] < quantity:
		return false
	inventory[item_id] -= quantity
	if inventory[item_id] <= 0:
		inventory.erase(item_id)
	return true


func has_item(item_id: String, quantity: int = 1) -> bool:
	return inventory.get(item_id, 0) >= quantity


func get_item_count(item_id: String) -> int:
	return inventory.get(item_id, 0)


# --- Quest Flags ---

func set_flag(flag_name: String, value: bool = true) -> void:
	quest_flags[flag_name] = value
	print("[GameState] Flag '%s' set to %s" % [flag_name, value])


func get_flag(flag_name: String) -> bool:
	return quest_flags.get(flag_name, false)


func clear_flag(flag_name: String) -> void:
	quest_flags.erase(flag_name)


# --- Counters ---

func add_counter(counter_name: String, amount: int = 1) -> void:
	if counters.has(counter_name):
		counters[counter_name] += amount
	else:
		counters[counter_name] = amount


func get_counter(counter_name: String) -> int:
	return counters.get(counter_name, 0)


func set_counter(counter_name: String, value: int) -> void:
	counters[counter_name] = value


# --- Container State ---

func mark_container_looted(container_id: String) -> void:
	looted_containers[container_id] = true


func is_container_looted(container_id: String) -> bool:
	return looted_containers.get(container_id, false)


# --- Reset (for new game) ---

func reset_all() -> void:
	inventory.clear()
	quest_flags.clear()
	counters = {"candy": 0, "gems": 0}
	looted_containers.clear()
