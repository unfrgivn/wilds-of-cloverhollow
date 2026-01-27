extends Node
# CostumeManager - Manages outfit unlocks and equipped costume state

signal outfit_unlocked(outfit_id: String, outfit_data: Dictionary)
signal outfit_equipped(outfit_id: String)
signal outfits_loaded

const OUTFITS_PATH := "res://game/data/outfits/outfits.json"
const PERSISTENCE_PATH := "user://costumes.json"

var _outfits: Dictionary = {}  # outfit_id -> outfit data
var _categories: Array = []
var _unlocked_outfits: Dictionary = {}  # outfit_id -> true
var _equipped_outfit: String = "default"
var _is_loaded: bool = false


func _ready() -> void:
    _load_outfit_data()
    _load_costume_state()


func _load_outfit_data() -> void:
    if not FileAccess.file_exists(OUTFITS_PATH):
        push_warning("CostumeManager: Outfit data file not found: " + OUTFITS_PATH)
        return
    
    var file := FileAccess.open(OUTFITS_PATH, FileAccess.READ)
    if file == null:
        push_error("CostumeManager: Failed to open outfit data: " + OUTFITS_PATH)
        return
    
    var json := JSON.new()
    var parse_result := json.parse(file.get_as_text())
    file.close()
    
    if parse_result != OK:
        push_error("CostumeManager: Failed to parse outfit data: " + json.get_error_message())
        return
    
    var data: Dictionary = json.data
    
    # Load outfits
    if data.has("outfits"):
        for outfit in data.outfits:
            _outfits[outfit.id] = outfit
            # Auto-unlock default outfits
            if outfit.get("unlocked_by_default", false):
                _unlocked_outfits[outfit.id] = true
    
    # Load categories
    if data.has("categories"):
        _categories = data.categories
    
    _is_loaded = true
    outfits_loaded.emit()


func _load_costume_state() -> void:
    if not FileAccess.file_exists(PERSISTENCE_PATH):
        return
    
    var file := FileAccess.open(PERSISTENCE_PATH, FileAccess.READ)
    if file == null:
        return
    
    var json := JSON.new()
    var parse_result := json.parse(file.get_as_text())
    file.close()
    
    if parse_result != OK:
        return
    
    var data: Dictionary = json.data
    if data.has("unlocked"):
        for outfit_id in data.unlocked:
            _unlocked_outfits[outfit_id] = true
    if data.has("equipped"):
        _equipped_outfit = data.equipped


func _save_costume_state() -> void:
    var file := FileAccess.open(PERSISTENCE_PATH, FileAccess.WRITE)
    if file == null:
        push_error("CostumeManager: Failed to save costume state")
        return
    
    var data := {
        "unlocked": _unlocked_outfits.keys(),
        "equipped": _equipped_outfit
    }
    file.store_string(JSON.stringify(data, "    "))
    file.close()


# Get all outfit data
func get_all_outfits() -> Array:
    return _outfits.values()


# Get outfit by ID
func get_outfit(outfit_id: String) -> Dictionary:
    return _outfits.get(outfit_id, {})


# Get outfits by category
func get_outfits_by_category(category: String) -> Array:
    var result := []
    for outfit in _outfits.values():
        if outfit.get("category", "") == category:
            result.append(outfit)
    return result


# Get all categories
func get_categories() -> Array:
    return _categories


# Check if outfit is unlocked
func is_outfit_unlocked(outfit_id: String) -> bool:
    return _unlocked_outfits.has(outfit_id)


# Get all unlocked outfits
func get_unlocked_outfits() -> Array:
    var result := []
    for outfit_id in _unlocked_outfits.keys():
        if _outfits.has(outfit_id):
            result.append(_outfits[outfit_id])
    return result


# Unlock an outfit
func unlock_outfit(outfit_id: String) -> void:
    if not _outfits.has(outfit_id):
        push_warning("CostumeManager: Unknown outfit ID: " + outfit_id)
        return
    
    if _unlocked_outfits.has(outfit_id):
        return  # Already unlocked
    
    _unlocked_outfits[outfit_id] = true
    _save_costume_state()
    outfit_unlocked.emit(outfit_id, _outfits[outfit_id])


# Equip an outfit
func equip_outfit(outfit_id: String) -> bool:
    if not _outfits.has(outfit_id):
        push_warning("CostumeManager: Unknown outfit ID: " + outfit_id)
        return false
    
    if not is_outfit_unlocked(outfit_id):
        push_warning("CostumeManager: Outfit not unlocked: " + outfit_id)
        return false
    
    _equipped_outfit = outfit_id
    _save_costume_state()
    outfit_equipped.emit(outfit_id)
    return true


# Get currently equipped outfit ID
func get_equipped_outfit() -> String:
    return _equipped_outfit


# Get currently equipped outfit data
func get_equipped_outfit_data() -> Dictionary:
    return _outfits.get(_equipped_outfit, {})


# Get sprite path for equipped outfit
func get_equipped_sprite_path() -> String:
    var outfit := get_equipped_outfit_data()
    return outfit.get("sprite_path", "res://game/assets/sprites/characters/player/default")


# Check unlock conditions and auto-unlock eligible outfits
func check_unlock_conditions() -> void:
    for outfit_id in _outfits.keys():
        if _unlocked_outfits.has(outfit_id):
            continue  # Already unlocked
        
        var outfit: Dictionary = _outfits[outfit_id]
        if outfit.get("unlocked_by_default", false):
            _unlocked_outfits[outfit_id] = true
            continue
        
        var condition: Dictionary = outfit.get("unlock_condition", {})
        if condition.is_empty():
            continue
        
        if _check_condition(condition):
            unlock_outfit(outfit_id)


func _check_condition(condition: Dictionary) -> bool:
    var condition_type: String = condition.get("type", "")
    var value = condition.get("value", "")
    
    match condition_type:
        "quest_completed":
            if Engine.has_singleton("InventoryManager") or has_node("/root/InventoryManager"):
                var inv = get_node_or_null("/root/InventoryManager")
                if inv:
                    return inv.has_story_flag("quest_completed_" + str(value))
            return false
        
        "story_flag":
            if Engine.has_singleton("InventoryManager") or has_node("/root/InventoryManager"):
                var inv = get_node_or_null("/root/InventoryManager")
                if inv:
                    return inv.has_story_flag(str(value))
            return false
        
        "collection":
            if Engine.has_singleton("CollectionLogManager") or has_node("/root/CollectionLogManager"):
                var clm = get_node_or_null("/root/CollectionLogManager")
                if clm:
                    var category: String = condition.get("category", "")
                    var count: int = int(value)
                    return clm.get_collected_count(category) >= count
            return false
        
        "photos_taken":
            if Engine.has_singleton("PhotoModeManager") or has_node("/root/PhotoModeManager"):
                var pmm = get_node_or_null("/root/PhotoModeManager")
                if pmm:
                    return pmm.get_photo_count() >= int(value)
            return false
        
        "affinity_level":
            if Engine.has_singleton("AffinityManager") or has_node("/root/AffinityManager"):
                var am = get_node_or_null("/root/AffinityManager")
                if am:
                    # Check if any NPC has reached the required level
                    var level_thresholds := {
                        "stranger": 0,
                        "acquaintance": 20,
                        "friend": 40,
                        "good_friend": 60,
                        "best_friend": 80,
                        "soulmate": 100
                    }
                    var required_affinity: int = level_thresholds.get(str(value), 100)
                    # Simplified check - would need NPC list in real implementation
                    return false
            return false
    
    return false


# Reset all unlocks (for testing)
func reset_unlocks() -> void:
    _unlocked_outfits.clear()
    _equipped_outfit = "default"
    # Re-apply default unlocks
    for outfit in _outfits.values():
        if outfit.get("unlocked_by_default", false):
            _unlocked_outfits[outfit.id] = true
    _save_costume_state()


# Save/load integration
func get_save_data() -> Dictionary:
    return {
        "unlocked": _unlocked_outfits.keys(),
        "equipped": _equipped_outfit
    }


func load_save_data(data: Dictionary) -> void:
    _unlocked_outfits.clear()
    if data.has("unlocked"):
        for outfit_id in data.unlocked:
            _unlocked_outfits[outfit_id] = true
    if data.has("equipped"):
        _equipped_outfit = data.equipped
    # Ensure default is always unlocked
    for outfit in _outfits.values():
        if outfit.get("unlocked_by_default", false):
            _unlocked_outfits[outfit.id] = true
    _save_costume_state()
