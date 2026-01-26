extends Node
## PartyManager - Handles party progression, XP, and leveling

## Party member runtime data: {member_id: {level, xp, ...}}
var party_state: Dictionary = {}

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
