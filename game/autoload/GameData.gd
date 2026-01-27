extends Node

signal data_reloaded(category: String)

var hot_reload_enabled := false
var _file_timestamps: Dictionary = {}
var _check_interval := 1.0
var _time_since_check := 0.0
const ENEMIES_PATH := "res://game/data/enemies/enemies.json"
const SKILLS_PATH := "res://game/data/skills/skills.json"
const ITEMS_PATH := "res://game/data/items/items.json"
const PARTY_PATH := "res://game/data/party/party.json"
const BIOMES_DIR := "res://game/data/biomes/"
const ENCOUNTERS_DIR := "res://game/data/encounters/"
const QUESTS_PATH := "res://game/data/quests/quests.json"
const NPC_SCHEDULES_PATH := "res://game/data/npcs/schedules.json"
const EQUIPMENT_PATH := "res://game/data/equipment/equipment.json"

## Cached data (dictionaries keyed by id)
var enemies: Dictionary = {}
var skills: Dictionary = {}
var items: Dictionary = {}
var party_members: Dictionary = {}
var biomes: Dictionary = {}
var encounters: Dictionary = {}
var quests: Dictionary = {}
var npc_schedules: Dictionary = {}
var equipment: Dictionary = {}

## Raw party data
var party_data: Dictionary = {}

func _ready() -> void:
	_load_all_data()
	_record_timestamps()

func _process(delta: float) -> void:
	if not hot_reload_enabled:
		return
	_time_since_check += delta
	if _time_since_check >= _check_interval:
		_time_since_check = 0.0
		_check_for_changes()

func _load_all_data() -> void:
	_load_enemies()
	_load_skills()
	_load_items()
	_load_party()
	_load_biomes()
	_load_encounters()
	_load_quests()
	_load_npc_schedules()
	_load_equipment()
	print("[GameData] All data loaded: %d enemies, %d skills, %d items, %d party members, %d quests, %d npc_schedules, %d equipment" % [
		enemies.size(), skills.size(), items.size(), party_members.size(), quests.size(), npc_schedules.size(), equipment.size()
	])

func _load_enemies() -> void:
	var data := _load_json(ENEMIES_PATH)
	if data.has("enemies"):
		for enemy in data["enemies"]:
			if enemy.has("id"):
				enemies[enemy["id"]] = enemy

func _load_skills() -> void:
	var data := _load_json(SKILLS_PATH)
	if data.has("skills"):
		for skill in data["skills"]:
			if skill.has("id"):
				skills[skill["id"]] = skill

func _load_items() -> void:
	var data := _load_json(ITEMS_PATH)
	if data.has("items"):
		for item in data["items"]:
			if item.has("id"):
				items[item["id"]] = item

func _load_party() -> void:
	party_data = _load_json(PARTY_PATH)
	if party_data.has("members"):
		for member in party_data["members"]:
			if member.has("id"):
				party_members[member["id"]] = member

func _load_biomes() -> void:
	var dir := DirAccess.open(BIOMES_DIR)
	if dir == null:
		push_warning("[GameData] Could not open biomes directory: %s" % BIOMES_DIR)
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if file_name.ends_with(".json"):
			var data := _load_json(BIOMES_DIR + file_name)
			if data.has("id"):
				biomes[data["id"]] = data
		file_name = dir.get_next()

func _load_encounters() -> void:
	var dir := DirAccess.open(ENCOUNTERS_DIR)
	if dir == null:
		push_warning("[GameData] Could not open encounters directory: %s" % ENCOUNTERS_DIR)
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if file_name.ends_with(".json"):
			var data := _load_json(ENCOUNTERS_DIR + file_name)
			if data.has("biome"):
				encounters[data["biome"]] = data
		file_name = dir.get_next()

func _load_quests() -> void:
	var data := _load_json(QUESTS_PATH)
	if data.has("quests"):
		for quest in data["quests"]:
			if quest.has("id"):
				quests[quest["id"]] = quest

func _load_npc_schedules() -> void:
	var data := _load_json(NPC_SCHEDULES_PATH)
	if data.has("schedules"):
		npc_schedules = data["schedules"]

func _load_equipment() -> void:
	var data := _load_json(EQUIPMENT_PATH)
	if data.has("equipment"):
		for equip in data["equipment"]:
			if equip.has("id"):
				equipment[equip["id"]] = equip

func _load_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		push_warning("[GameData] File not found: %s" % path)
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_warning("[GameData] Could not open file: %s" % path)
		return {}
	var json_string := file.get_as_text()
	file.close()
	var json := JSON.new()
	var error := json.parse(json_string)
	if error != OK:
		push_error("[GameData] JSON parse error in %s: %s" % [path, json.get_error_message()])
		return {}
	return json.data

## Get enemy data by id
func get_enemy(enemy_id: String) -> Dictionary:
	if enemies.has(enemy_id):
		return enemies[enemy_id]
	push_warning("[GameData] Enemy not found: %s" % enemy_id)
	return {}

## Get skill data by id
func get_skill(skill_id: String) -> Dictionary:
	if skills.has(skill_id):
		return skills[skill_id]
	push_warning("[GameData] Skill not found: %s" % skill_id)
	return {}

## Get item data by id
func get_item(item_id: String) -> Dictionary:
	if items.has(item_id):
		return items[item_id]
	push_warning("[GameData] Item not found: %s" % item_id)
	return {}

## Get party member data by id
func get_party_member(member_id: String) -> Dictionary:
	if party_members.has(member_id):
		return party_members[member_id]
	push_warning("[GameData] Party member not found: %s" % member_id)
	return {}

## Get all party member data in order
func get_all_party_members() -> Array:
	if party_data.has("members"):
		return party_data["members"]
	return []

## Get full party data including thresholds and growth
func get_party_data() -> Dictionary:
	return party_data

## Get biome data by id
func get_biome(biome_id: String) -> Dictionary:
	if biomes.has(biome_id):
		return biomes[biome_id]
	push_warning("[GameData] Biome not found: %s" % biome_id)
	return {}

## Get encounters for a biome
func get_encounters_for_biome(biome_id: String) -> Dictionary:
	if encounters.has(biome_id):
		return encounters[biome_id]
	push_warning("[GameData] Encounters not found for biome: %s" % biome_id)
	return {}

## Get quest data by id
func get_quest(quest_id: String) -> Dictionary:
	if quests.has(quest_id):
		return quests[quest_id]
	push_warning("[GameData] Quest not found: %s" % quest_id)
	return {}

## Get all available quests (optionally filter by completion status)
func get_available_quests() -> Array:
	var result: Array = []
	for quest_id in quests.keys():
		var quest = quests[quest_id]
		# Check if quest has a required flag that isn't met
		var required_flag = quest.get("required_flag")
		if required_flag != null and required_flag != "":
			if not InventoryManager.has_story_flag(required_flag):
				continue
		# Check if quest is already completed
		var completion_flag = quest.get("completion_flag", "")
		if completion_flag != "" and InventoryManager.has_story_flag(completion_flag):
			continue
		result.append(quest)
	return result

## Get all NPC schedules
func get_npc_schedules() -> Dictionary:
	return npc_schedules

## Get schedule for a specific NPC
func get_npc_schedule(npc_id_param: String) -> Dictionary:
	if npc_schedules.has(npc_id_param):
		return npc_schedules[npc_id_param]
	return {}

## Get equipment data by id
func get_equipment(equip_id: String) -> Dictionary:
	if equipment.has(equip_id):
		return equipment[equip_id]
	push_warning("[GameData] Equipment not found: %s" % equip_id)
	return {}

## Get all equipment
func get_all_equipment() -> Array:
	return equipment.values()

func enable_hot_reload(enabled: bool = true) -> void:
	hot_reload_enabled = enabled
	if enabled:
		_record_timestamps()
		print("[GameData] Hot reload enabled")
	else:
		print("[GameData] Hot reload disabled")

func reload_all() -> void:
	print("[GameData] Reloading all data...")
	enemies.clear()
	skills.clear()
	items.clear()
	party_members.clear()
	biomes.clear()
	encounters.clear()
	quests.clear()
	npc_schedules.clear()
	equipment.clear()
	party_data.clear()
	_load_all_data()
	_record_timestamps()
	data_reloaded.emit("all")

func _record_timestamps() -> void:
	_file_timestamps.clear()
	var paths := [ENEMIES_PATH, SKILLS_PATH, ITEMS_PATH, PARTY_PATH, QUESTS_PATH, NPC_SCHEDULES_PATH, EQUIPMENT_PATH]
	for path in paths:
		_file_timestamps[path] = _get_file_mtime(path)
	_record_directory_timestamps(BIOMES_DIR)
	_record_directory_timestamps(ENCOUNTERS_DIR)

func _record_directory_timestamps(dir_path: String) -> void:
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return
	dir.list_dir_begin()
	var file_name := dir.get_next()
	while file_name != "":
		if file_name.ends_with(".json"):
			var full_path := dir_path + file_name
			_file_timestamps[full_path] = _get_file_mtime(full_path)
		file_name = dir.get_next()

func _get_file_mtime(path: String) -> int:
	if not FileAccess.file_exists(path):
		return 0
	return FileAccess.get_modified_time(path)

func _check_for_changes() -> void:
	var changed := false
	for path in _file_timestamps.keys():
		var current_mtime := _get_file_mtime(path)
		if current_mtime != _file_timestamps[path]:
			print("[GameData] File changed: %s" % path)
			changed = true
			break
	if changed:
		reload_all()
