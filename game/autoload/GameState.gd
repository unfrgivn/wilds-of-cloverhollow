extends Node

var flags := {}
var inventory := {}
var quests := {}
var values := {}
var party_members: Array[String] = []
var input_blocked := false


func set_flag(key: String, value: bool = true) -> void:
	flags[key] = value


func get_flag(key: String, default_value: bool = false) -> bool:
	return flags.get(key, default_value)


func add_item(item_id: String, count: int = 1) -> void:
	var current = int(inventory.get(item_id, 0))
	inventory[item_id] = current + count


func remove_item(item_id: String, count: int = 1) -> bool:
	if count <= 0:
		return false
	var current = int(inventory.get(item_id, 0))
	if current < count:
		return false
	var next_count = current - count
	if next_count <= 0:
		inventory.erase(item_id)
	else:
		inventory[item_id] = next_count
	return true


func has_item(item_id: String, count: int = 1) -> bool:
	return get_item_count(item_id) >= max(count, 1)


func get_item_count(item_id: String) -> int:
	return int(inventory.get(item_id, 0))


func set_quest_state(quest_id: String, state: Dictionary) -> void:
	quests[quest_id] = state.duplicate()


func get_quest_state(quest_id: String) -> Dictionary:
	return quests.get(quest_id, {}).duplicate()


func has_quest(quest_id: String) -> bool:
	return quests.has(quest_id)


func clear_quest(quest_id: String) -> void:
	quests.erase(quest_id)


func add_party_member(member_id: String) -> bool:
	if member_id.is_empty() or party_members.has(member_id):
		return false
	party_members.append(member_id)
	return true


func remove_party_member(member_id: String) -> bool:
	if not party_members.has(member_id):
		return false
	party_members.erase(member_id)
	return true


func has_party_member(member_id: String) -> bool:
	return party_members.has(member_id)


func get_party() -> Array[String]:
	return party_members.duplicate()


func set_value(key: String, value: Variant) -> void:
	values[key] = value


func get_value(key: String, default_value: Variant = null) -> Variant:
	return values.get(key, default_value)


func clear_value(key: String) -> void:
	values.erase(key)


func reset() -> void:
	flags = {}
	inventory = {}
	quests = {}
	values = {}
	party_members = []
	input_blocked = false


func to_dict() -> Dictionary:
	return {
		"flags": flags.duplicate(),
		"inventory": inventory.duplicate(),
		"quests": quests.duplicate(),
		"values": values.duplicate(),
		"party": party_members.duplicate(),
	}


func from_dict(data: Dictionary) -> void:
	flags = data.get("flags", {}).duplicate()
	inventory = data.get("inventory", {}).duplicate()
	quests = data.get("quests", {}).duplicate()
	values = data.get("values", {}).duplicate()
	party_members = data.get("party", []).duplicate()


func save_to_file(path: String) -> bool:
	var resolved = _resolve_path(path)
	if resolved.is_empty():
		return false
	DirAccess.make_dir_recursive_absolute(resolved.get_base_dir())
	var file = FileAccess.open(resolved, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(to_dict(), "\t"))
	return true


func load_from_file(path: String) -> bool:
	var resolved = _resolve_path(path)
	if resolved.is_empty() or not FileAccess.file_exists(resolved):
		return false
	var file = FileAccess.open(resolved, FileAccess.READ)
	if file == null:
		return false
	var parsed = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return false
	from_dict(parsed)
	return true


func _resolve_path(path: String) -> String:
	if path.is_empty():
		return ""
	if path.begins_with("user://") or path.begins_with("res://"):
		return ProjectSettings.globalize_path(path)
	if path.is_absolute_path():
		return path
	return ProjectSettings.globalize_path("user://" + path)
