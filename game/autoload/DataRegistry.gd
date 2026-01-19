extends Node

var enemies: Dictionary = {}
var party_members: Dictionary = {}
var encounters: Dictionary = {}
var items: Dictionary = {}
var skills: Dictionary = {}
var biomes: Dictionary = {}
var quests: Dictionary = {}


func _ready() -> void:
	load_all()


func load_all() -> void:
	enemies = _load_defs("res://game/data/enemies")
	party_members = _load_defs("res://game/data/characters")
	encounters = _load_defs("res://game/data/encounters")
	items = _load_defs("res://game/data/items")
	skills = _load_defs("res://game/data/skills")
	biomes = _load_defs("res://game/data/biomes")
	quests = _load_defs("res://game/data/quests")


func get_enemy(enemy_id: String) -> Resource:
	return enemies.get(enemy_id, null)


func get_party_member(member_id: String) -> Resource:
	return party_members.get(member_id, null)


func get_encounter(encounter_id: String) -> Resource:
	return encounters.get(encounter_id, null)


func get_item(item_id: String) -> Resource:
	return items.get(item_id, null)


func get_tool(tool_id: String) -> Resource:
	var item = items.get(tool_id, null)
	if item == null:
		return null
	var is_tool = bool(item.get("is_tool"))
	if is_tool:
		return item
	return null


func get_skill(skill_id: String) -> Resource:
	return skills.get(skill_id, null)


func get_biome(biome_id: String) -> Resource:
	return biomes.get(biome_id, null)


func get_quest(quest_id: String) -> Resource:
	return quests.get(quest_id, null)


func _load_defs(path: String, _expected_script: Script = null) -> Dictionary:
	var result: Dictionary = {}
	var files = DirAccess.get_files_at(path)
	for file_name in files:
		if not (file_name.ends_with(".tres") or file_name.ends_with(".res")):
			continue
		var resource = load(path.path_join(file_name))
		if resource == null:
			continue
		var id_value = String(resource.get("id"))
		if id_value.is_empty():
			continue
		result[id_value] = resource
	return result
