extends Node
## PartyManager - Handles party progression, XP, and leveling

signal pet_selected(pet_id: String)

## Party member runtime data: {member_id: {level, xp, ...}}
var party_state: Dictionary = {}

## Equipment state: {member_id: {weapon: "", armor: "", accessory: ""}}
var equipment_state: Dictionary = {}

## Active pet ID (selected at game start)
var active_pet_id: String = "maddie"

## Available pet options from GameData
var pet_options: Array = []

## Cached data from GameData
var level_thresholds: Array = []
var stat_growth: Dictionary = {}

func _ready() -> void:
	_load_party_data()
	print("[PartyManager] Initialized with %d party members" % party_state.size())

func _load_party_data() -> void:
	var party_data: Dictionary = GameData.get_party_data()
	level_thresholds = party_data.get("level_thresholds", [0, 10, 25, 50, 80, 120])
	stat_growth = party_data.get("stat_growth", {})
	pet_options = party_data.get("pet_options", [])
	
	for member in party_data.get("members", []):
		var member_id: String = member.get("id", "")
		party_state[member_id] = {
			"id": member_id,
			"name": member.get("name", "Unknown"),
			"level": member.get("level", 1),
			"xp": member.get("xp", 0),
			"max_hp": member.get("max_hp", 20),
			"max_mp": member.get("max_mp", 10),
			"attack": member.get("attack", 5),
			"defense": member.get("defense", 3),
			"speed": member.get("speed", 5)
		}
		# Initialize equipment slots
		equipment_state[member_id] = {
			"weapon": "",
			"armor": "",
			"accessory": ""
		}

## Award XP to all party members (called after battle victory)
func award_xp(xp_amount: int) -> Array:
	var level_ups: Array = []
	
	for member_id in party_state.keys():
		var member: Dictionary = party_state[member_id]
		var old_level: int = member.level
		member.xp += xp_amount
		
		# Check for level up
		var new_level: int = _calculate_level(member.xp)
		if new_level > old_level:
			var levels_gained: int = new_level - old_level
			member.level = new_level
			_apply_stat_growth(member_id, levels_gained)
			level_ups.append({
				"member_id": member_id,
				"name": member.name,
				"old_level": old_level,
				"new_level": new_level
			})
			print("[PartyManager] %s leveled up! %d -> %d" % [member.name, old_level, new_level])
	
	return level_ups

func _calculate_level(xp: int) -> int:
	var level: int = 1
	for i in range(level_thresholds.size()):
		if xp >= level_thresholds[i]:
			level = i + 1
		else:
			break
	return level

func _apply_stat_growth(member_id: String, levels: int) -> void:
	var member: Dictionary = party_state[member_id]
	member.max_hp += stat_growth.get("hp_per_level", 3) * levels
	member.max_mp += stat_growth.get("mp_per_level", 2) * levels
	member.attack += stat_growth.get("attack_per_level", 1) * levels
	member.defense += stat_growth.get("defense_per_level", 1) * levels
	member.speed += stat_growth.get("speed_per_level", 0) * levels

## Get current member state
func get_member_state(member_id: String) -> Dictionary:
	return party_state.get(member_id, {})

## Get all party state for saving
func get_all_state() -> Dictionary:
	return party_state.duplicate(true)

## Restore party state from save
func load_state(state: Dictionary) -> void:
	party_state = state.duplicate(true)
	print("[PartyManager] State loaded for %d members" % party_state.size())

## Equip an item to a party member
func equip_item(member_id: String, equip_id: String) -> bool:
	if not equipment_state.has(member_id):
		push_warning("[PartyManager] Member not found: %s" % member_id)
		return false
	
	var equip_data: Dictionary = GameData.get_equipment(equip_id)
	if equip_data.is_empty():
		return false
	
	var slot: String = equip_data.get("slot", "")
	if slot not in ["weapon", "armor", "accessory"]:
		push_warning("[PartyManager] Invalid equipment slot: %s" % slot)
		return false
	
	# Unequip existing item in that slot first
	unequip_slot(member_id, slot)
	
	# Equip new item
	equipment_state[member_id][slot] = equip_id
	print("[PartyManager] %s equipped %s in %s slot" % [member_id, equip_id, slot])
	return true

## Unequip item from a specific slot
func unequip_slot(member_id: String, slot: String) -> String:
	if not equipment_state.has(member_id):
		return ""
	var current_equip: String = equipment_state[member_id].get(slot, "")
	if current_equip != "":
		equipment_state[member_id][slot] = ""
		print("[PartyManager] %s unequipped %s from %s slot" % [member_id, current_equip, slot])
	return current_equip

## Get equipment for a member
func get_equipment(member_id: String) -> Dictionary:
	return equipment_state.get(member_id, {"weapon": "", "armor": "", "accessory": ""})

## Get total stat with equipment bonuses
func get_stat_with_equipment(member_id: String, stat: String) -> int:
	var member: Dictionary = party_state.get(member_id, {})
	var base_stat: int = member.get(stat, 0)
	var bonus: int = 0
	
	var equip: Dictionary = equipment_state.get(member_id, {})
	for slot in ["weapon", "armor", "accessory"]:
		var equip_id: String = equip.get(slot, "")
		if equip_id != "":
			var equip_data: Dictionary = GameData.get_equipment(equip_id)
			bonus += equip_data.get(stat + "_bonus", 0)
	
	return base_stat + bonus

## Get all equipment state for saving
func get_equipment_state() -> Dictionary:
	return equipment_state.duplicate(true)

## Restore equipment state from save
func load_equipment_state(state: Dictionary) -> void:
	equipment_state = state.duplicate(true)
	print("[PartyManager] Equipment state loaded")

## Get available pet options
func get_pet_options() -> Array:
	return pet_options

## Get pet data by ID from pet_options
func get_pet_data(pet_id: String) -> Dictionary:
	for pet in pet_options:
		if pet.get("id", "") == pet_id:
			return pet
	return {}

## Set the active pet (called at game start)
func set_active_pet(pet_id: String) -> bool:
	var pet_data: Dictionary = get_pet_data(pet_id)
	if pet_data.is_empty():
		push_warning("[PartyManager] Pet not found: %s" % pet_id)
		return false
	
	active_pet_id = pet_id
	
	# Update the pet entry in party_state with the selected pet's stats
	party_state["maddie"] = {
		"id": pet_data.get("id", pet_id),
		"name": pet_data.get("name", "Pet"),
		"level": 1,
		"xp": 0,
		"max_hp": pet_data.get("max_hp", 15),
		"max_mp": pet_data.get("max_mp", 5),
		"attack": pet_data.get("attack", 4),
		"defense": pet_data.get("defense", 2),
		"speed": pet_data.get("speed", 8)
	}
	# Also store under the actual pet ID for lookups
	if pet_id != "maddie":
		party_state[pet_id] = party_state["maddie"].duplicate()
	
	print("[PartyManager] Active pet set to: %s (%s)" % [pet_data.get("name", pet_id), pet_id])
	pet_selected.emit(pet_id)
	return true

## Get the currently active pet ID
func get_active_pet() -> String:
	return active_pet_id

## Get active pet data
func get_active_pet_data() -> Dictionary:
	return get_pet_data(active_pet_id)
