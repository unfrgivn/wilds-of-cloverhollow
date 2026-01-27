extends Node
# PetAccessoryManager - Manages pet accessory unlocks and equipped state

signal accessory_unlocked(accessory_id: String, accessory_data: Dictionary)
signal accessory_equipped(slot: String, accessory_id: String)
signal accessory_unequipped(slot: String)
signal accessories_loaded

const ACCESSORIES_PATH := "res://game/data/accessories/pet_accessories.json"
const PERSISTENCE_PATH := "user://pet_accessories.json"

var _accessories: Dictionary = {}  # accessory_id -> accessory data
var _categories: Array = []
var _slots: Array = []
var _unlocked_accessories: Dictionary = {}  # accessory_id -> true
var _equipped_accessories: Dictionary = {}  # slot -> accessory_id
var _is_loaded: bool = false


func _ready() -> void:
    _load_accessory_data()
    _load_accessory_state()


func _load_accessory_data() -> void:
    if not FileAccess.file_exists(ACCESSORIES_PATH):
        push_warning("PetAccessoryManager: Accessory data file not found: " + ACCESSORIES_PATH)
        return
    
    var file := FileAccess.open(ACCESSORIES_PATH, FileAccess.READ)
    if file == null:
        push_error("PetAccessoryManager: Failed to open accessory data: " + ACCESSORIES_PATH)
        return
    
    var json := JSON.new()
    var parse_result := json.parse(file.get_as_text())
    file.close()
    
    if parse_result != OK:
        push_error("PetAccessoryManager: Failed to parse accessory data: " + json.get_error_message())
        return
    
    var data: Dictionary = json.data
    
    # Load accessories
    if data.has("accessories"):
        for accessory in data.accessories:
            _accessories[accessory.id] = accessory
            # Auto-unlock default accessories
            if accessory.get("unlocked_by_default", false):
                _unlocked_accessories[accessory.id] = true
    
    # Load categories
    if data.has("categories"):
        _categories = data.categories
    
    # Load slots
    if data.has("slots"):
        _slots = data.slots
    
    _is_loaded = true
    accessories_loaded.emit()


func _load_accessory_state() -> void:
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
        for accessory_id in data.unlocked:
            _unlocked_accessories[accessory_id] = true
    if data.has("equipped"):
        _equipped_accessories = data.equipped


func _save_accessory_state() -> void:
    var file := FileAccess.open(PERSISTENCE_PATH, FileAccess.WRITE)
    if file == null:
        push_error("PetAccessoryManager: Failed to save accessory state")
        return
    
    var data := {
        "unlocked": _unlocked_accessories.keys(),
        "equipped": _equipped_accessories
    }
    file.store_string(JSON.stringify(data, "    "))
    file.close()


# Get all accessory data
func get_all_accessories() -> Array:
    return _accessories.values()


# Get accessory by ID
func get_accessory(accessory_id: String) -> Dictionary:
    return _accessories.get(accessory_id, {})


# Get accessories by category
func get_accessories_by_category(category: String) -> Array:
    var result := []
    for accessory in _accessories.values():
        if accessory.get("category", "") == category:
            result.append(accessory)
    return result


# Get accessories by slot
func get_accessories_by_slot(slot: String) -> Array:
    var result := []
    for accessory in _accessories.values():
        if accessory.get("slot", "") == slot:
            result.append(accessory)
    return result


# Get all categories
func get_categories() -> Array:
    return _categories


# Get all slots
func get_slots() -> Array:
    return _slots


# Check if accessory is unlocked
func is_accessory_unlocked(accessory_id: String) -> bool:
    return _unlocked_accessories.has(accessory_id)


# Get all unlocked accessories
func get_unlocked_accessories() -> Array:
    var result := []
    for accessory_id in _unlocked_accessories.keys():
        if _accessories.has(accessory_id):
            result.append(_accessories[accessory_id])
    return result


# Unlock an accessory
func unlock_accessory(accessory_id: String) -> void:
    if not _accessories.has(accessory_id):
        push_warning("PetAccessoryManager: Unknown accessory ID: " + accessory_id)
        return
    
    if _unlocked_accessories.has(accessory_id):
        return  # Already unlocked
    
    _unlocked_accessories[accessory_id] = true
    _save_accessory_state()
    accessory_unlocked.emit(accessory_id, _accessories[accessory_id])


# Equip an accessory
func equip_accessory(accessory_id: String) -> bool:
    if not _accessories.has(accessory_id):
        push_warning("PetAccessoryManager: Unknown accessory ID: " + accessory_id)
        return false
    
    if not is_accessory_unlocked(accessory_id):
        push_warning("PetAccessoryManager: Accessory not unlocked: " + accessory_id)
        return false
    
    var accessory: Dictionary = _accessories[accessory_id]
    var slot: String = accessory.get("slot", "")
    
    if slot.is_empty():
        push_warning("PetAccessoryManager: Accessory has no slot: " + accessory_id)
        return false
    
    _equipped_accessories[slot] = accessory_id
    _save_accessory_state()
    accessory_equipped.emit(slot, accessory_id)
    return true


# Unequip an accessory from a slot
func unequip_slot(slot: String) -> void:
    if not _equipped_accessories.has(slot):
        return
    
    _equipped_accessories.erase(slot)
    _save_accessory_state()
    accessory_unequipped.emit(slot)


# Get equipped accessory for a slot
func get_equipped_accessory(slot: String) -> String:
    return _equipped_accessories.get(slot, "")


# Get all equipped accessories
func get_equipped_accessories() -> Dictionary:
    return _equipped_accessories.duplicate()


# Get equipped accessory data for a slot
func get_equipped_accessory_data(slot: String) -> Dictionary:
    var accessory_id: String = _equipped_accessories.get(slot, "")
    if accessory_id.is_empty():
        return {}
    return _accessories.get(accessory_id, {})


# Check unlock conditions and auto-unlock eligible accessories
func check_unlock_conditions() -> void:
    for accessory_id in _accessories.keys():
        if _unlocked_accessories.has(accessory_id):
            continue  # Already unlocked
        
        var accessory: Dictionary = _accessories[accessory_id]
        if accessory.get("unlocked_by_default", false):
            _unlocked_accessories[accessory_id] = true
            continue
        
        var condition: Dictionary = accessory.get("unlock_condition", {})
        if condition.is_empty():
            continue
        
        if _check_condition(condition):
            unlock_accessory(accessory_id)


func _check_condition(condition: Dictionary) -> bool:
    var condition_type: String = condition.get("type", "")
    var value = condition.get("value", "")
    
    match condition_type:
        "quest_completed":
            var inv = get_node_or_null("/root/InventoryManager")
            if inv:
                return inv.has_story_flag("quest_completed_" + str(value))
            return false
        
        "story_flag":
            var inv = get_node_or_null("/root/InventoryManager")
            if inv:
                return inv.has_story_flag(str(value))
            return false
        
        "collection":
            var clm = get_node_or_null("/root/CollectionLogManager")
            if clm:
                var category: String = condition.get("category", "")
                var count: int = int(value)
                return clm.get_collected_count(category) >= count
            return false
        
        "affinity_level":
            var am = get_node_or_null("/root/AffinityManager")
            if am:
                # Simplified check
                return false
            return false
    
    return false


# Reset all unlocks (for testing)
func reset_unlocks() -> void:
    _unlocked_accessories.clear()
    _equipped_accessories.clear()
    # Re-apply default unlocks
    for accessory in _accessories.values():
        if accessory.get("unlocked_by_default", false):
            _unlocked_accessories[accessory.id] = true
    _save_accessory_state()


# Save/load integration
func get_save_data() -> Dictionary:
    return {
        "unlocked": _unlocked_accessories.keys(),
        "equipped": _equipped_accessories.duplicate()
    }


func load_save_data(data: Dictionary) -> void:
    _unlocked_accessories.clear()
    _equipped_accessories.clear()
    if data.has("unlocked"):
        for accessory_id in data.unlocked:
            _unlocked_accessories[accessory_id] = true
    if data.has("equipped"):
        _equipped_accessories = data.equipped.duplicate()
    # Ensure defaults are always unlocked
    for accessory in _accessories.values():
        if accessory.get("unlocked_by_default", false):
            _unlocked_accessories[accessory.id] = true
    _save_accessory_state()
