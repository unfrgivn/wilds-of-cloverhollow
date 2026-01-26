extends Node
## AffinityManager - Tracks relationship/friendship levels with NPCs
## Affinity ranges from 0 (stranger) to 100 (best friend)

signal affinity_changed(npc_id: String, old_value: int, new_value: int)
signal affinity_level_up(npc_id: String, new_level: String)

# Affinity levels and their thresholds
const LEVELS := {
    0: "Stranger",
    20: "Acquaintance",
    40: "Friend",
    60: "Good Friend",
    80: "Best Friend",
    100: "Soulmate"
}

# Current affinity scores by NPC ID
var _affinity: Dictionary = {}

# NPC affinity data (loaded from JSON)
var _npc_data: Dictionary = {}

func _ready() -> void:
    _load_affinity_data()

func _load_affinity_data() -> void:
    var path = "res://game/data/npcs/affinity.json"
    if not FileAccess.file_exists(path):
        return
    var file = FileAccess.open(path, FileAccess.READ)
    if file == null:
        return
    var json = JSON.new()
    var result = json.parse(file.get_as_text())
    if result == OK:
        _npc_data = json.get_data()

## Get current affinity with an NPC (0-100)
func get_affinity(npc_id: String) -> int:
    if _affinity.has(npc_id):
        return _affinity[npc_id]
    # Check if NPC has starting affinity in data
    if _npc_data.has("npcs"):
        for npc in _npc_data["npcs"]:
            if npc.get("id", "") == npc_id:
                var starting = npc.get("starting_affinity", 0)
                _affinity[npc_id] = starting
                return starting
    return 0

## Change affinity by an amount (positive or negative)
func change_affinity(npc_id: String, amount: int) -> void:
    var old_value = get_affinity(npc_id)
    var new_value = clamp(old_value + amount, 0, 100)
    
    if old_value == new_value:
        return
    
    var old_level = get_level(old_value)
    _affinity[npc_id] = new_value
    var new_level = get_level(new_value)
    
    affinity_changed.emit(npc_id, old_value, new_value)
    
    if old_level != new_level and new_value > old_value:
        affinity_level_up.emit(npc_id, new_level)

## Set affinity to a specific value
func set_affinity(npc_id: String, value: int) -> void:
    var old_value = get_affinity(npc_id)
    var new_value = clamp(value, 0, 100)
    
    if old_value == new_value:
        return
    
    _affinity[npc_id] = new_value
    affinity_changed.emit(npc_id, old_value, new_value)

## Get the relationship level name for a given affinity value
func get_level(affinity: int) -> String:
    var level_name = "Stranger"
    for threshold in LEVELS:
        if affinity >= threshold:
            level_name = LEVELS[threshold]
    return level_name

## Get the level name for an NPC
func get_npc_level(npc_id: String) -> String:
    return get_level(get_affinity(npc_id))

## Get NPC display name from data
func get_npc_name(npc_id: String) -> String:
    if _npc_data.has("npcs"):
        for npc in _npc_data["npcs"]:
            if npc.get("id", "") == npc_id:
                return npc.get("name", npc_id)
    return npc_id

## Get all NPCs with tracked affinity
func get_all_affinity() -> Dictionary:
    # Return copy to prevent external modification
    return _affinity.duplicate()

## Get NPCs sorted by affinity (highest first)
func get_sorted_npcs() -> Array:
    var result: Array = []
    for npc_id in _affinity:
        result.append({"id": npc_id, "affinity": _affinity[npc_id]})
    result.sort_custom(func(a, b): return a["affinity"] > b["affinity"])
    return result

## Save/load support
func get_save_data() -> Dictionary:
    return {"affinity": _affinity.duplicate()}

func load_save_data(data: Dictionary) -> void:
    _affinity = data.get("affinity", {}).duplicate()
