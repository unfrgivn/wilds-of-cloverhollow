extends Node
## InventoryManager - Tracks tools, items, and story flags

signal inventory_changed
signal tool_acquired(tool_id: String)
signal item_added(item_id: String, count: int)
signal item_removed(item_id: String, count: int)
signal story_flag_changed(flag: String, value: Variant)
signal inventory_full(item_id: String, attempted_count: int)

## Inventory limits
const MAX_ITEM_STACKS: int = 20  # Maximum unique item types
const MAX_STACK_SIZE: int = 99   # Maximum per item type

## Tools the player has acquired (lantern, journal, lasso, flute)
## Key: tool_id, Value: true if owned
var tools: Dictionary = {}

## Items in inventory
## Key: item_id, Value: count
var items: Dictionary = {}

## Story/progression flags
## Key: flag name, Value: any value (bool, int, string)
var story_flags: Dictionary = {}

## Tool IDs for the adventure tools
const TOOL_LANTERN := "lantern"
const TOOL_JOURNAL := "journal"
const TOOL_LASSO := "lasso"
const TOOL_FLUTE := "flute"

func _ready() -> void:
	pass

## Check if player has a specific tool
func has_tool(tool_id: String) -> bool:
	return tools.get(tool_id, false)

## Give a tool to the player
func acquire_tool(tool_id: String) -> void:
	if not tools.get(tool_id, false):
		tools[tool_id] = true
		SFXManager.play("tool_acquire")
		NotificationManager.show_tool_acquired(tool_id.capitalize())
		tool_acquired.emit(tool_id)
		inventory_changed.emit()
		print("[InventoryManager] Tool acquired: %s" % tool_id)

## Remove a tool from the player (for special scenarios)
func remove_tool(tool_id: String) -> void:
	if tools.has(tool_id):
		tools.erase(tool_id)
		inventory_changed.emit()

## Get count of an item
func get_item_count(item_id: String) -> int:
	var count: int = items.get(item_id, 0)
	return count

## Add item(s) to inventory. Returns true if added, false if inventory full.
func add_item(item_id: String, count: int = 1) -> bool:
	if count <= 0:
		return false
	
	var current: int = items.get(item_id, 0)
	
	# Check if this is a new item type and we're at capacity
	if current == 0 and items.size() >= MAX_ITEM_STACKS:
		push_warning("[InventoryManager] Inventory full! Cannot add new item type: %s" % item_id)
		NotificationManager.show_notification("Inventory Full", "Cannot carry more item types!", NotificationManager.NotificationType.INFO)
		inventory_full.emit(item_id, count)
		return false
	
	# Check stack limit
	var space_available: int = MAX_STACK_SIZE - current
	if space_available <= 0:
		push_warning("[InventoryManager] Item stack full for: %s" % item_id)
		NotificationManager.show_notification("Stack Full", "Cannot carry more %s!" % item_id.capitalize(), NotificationManager.NotificationType.INFO)
		inventory_full.emit(item_id, count)
		return false
	
	# Add what we can (partial pickup if limited)
	var to_add: int = mini(count, space_available)
	SFXManager.play_item_pickup()
	NotificationManager.show_item_obtained(item_id.capitalize(), to_add)
	items[item_id] = current + to_add
	item_added.emit(item_id, to_add)
	inventory_changed.emit()
	print("[InventoryManager] Item added: %s x%d (now have %d)" % [item_id, to_add, items[item_id]])
	
	# If we couldn't add everything, signal inventory full for the remainder
	if to_add < count:
		inventory_full.emit(item_id, count - to_add)
		return false
	
	return true

## Remove item(s) from inventory
func remove_item(item_id: String, count: int = 1) -> bool:
	var current: int = items.get(item_id, 0)
	if current < count:
		return false
	items[item_id] = current - count
	if items[item_id] <= 0:
		items.erase(item_id)
	item_removed.emit(item_id, count)
	inventory_changed.emit()
	return true

## Check if player has at least N of an item
func has_item(item_id: String, count: int = 1) -> bool:
	return get_item_count(item_id) >= count

## Get current number of unique item types
func get_unique_item_count() -> int:
	return items.size()

## Check if inventory has space for a new item type
func has_inventory_space() -> bool:
	return items.size() < MAX_ITEM_STACKS

## Check if a specific item can accept more
func can_add_item(item_id: String, count: int = 1) -> bool:
	var current: int = items.get(item_id, 0)
	if current == 0:
		return items.size() < MAX_ITEM_STACKS
	return current + count <= MAX_STACK_SIZE

## Get remaining space for an item
func get_item_space(item_id: String) -> int:
	var current: int = items.get(item_id, 0)
	if current == 0 and items.size() >= MAX_ITEM_STACKS:
		return 0
	return MAX_STACK_SIZE - current

## Story flag management
func set_story_flag(flag: String, value: Variant = true) -> void:
	var old_value = story_flags.get(flag)
	story_flags[flag] = value
	if old_value != value:
		story_flag_changed.emit(flag, value)
		print("[InventoryManager] Story flag set: %s = %s" % [flag, str(value)])

func get_story_flag(flag: String, default_value: Variant = false) -> Variant:
	return story_flags.get(flag, default_value)

func has_story_flag(flag: String) -> bool:
	return story_flags.has(flag) and story_flags[flag]

## Clear story flag
func clear_story_flag(flag: String) -> void:
	if story_flags.has(flag):
		story_flags.erase(flag)
		story_flag_changed.emit(flag, false)

## Get all tools as a list
func get_owned_tools() -> Array[String]:
	var result: Array[String] = []
	for tool_id in tools.keys():
		if tools[tool_id]:
			result.append(tool_id)
	return result

## Get all items as dictionary (for display)
func get_all_items() -> Dictionary:
	return items.duplicate()

## Save/Load support
func get_save_data() -> Dictionary:
	return {
		"tools": tools.duplicate(),
		"items": items.duplicate()
	}

func load_save_data(data: Dictionary) -> void:
	tools = data.get("tools", {}).duplicate()
	items = data.get("items", {}).duplicate()
	inventory_changed.emit()
	print("[InventoryManager] Loaded: %d tools, %d item types" % [tools.size(), items.size()])

func get_story_flags() -> Dictionary:
	return story_flags.duplicate()

func set_story_flags(flags: Dictionary) -> void:
	story_flags = flags.duplicate()
	print("[InventoryManager] Loaded %d story flags" % story_flags.size())

## Reset inventory (new game)
func reset() -> void:
	tools.clear()
	items.clear()
	story_flags.clear()
	inventory_changed.emit()
