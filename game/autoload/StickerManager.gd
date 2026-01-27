extends Node
# StickerManager - Manages sticker unlocks and data for photo decoration

signal sticker_unlocked(sticker_id: String, sticker_data: Dictionary)
signal stickers_loaded

const STICKERS_PATH := "res://game/data/stickers/stickers.json"
const PERSISTENCE_PATH := "user://stickers.json"

var _stickers: Dictionary = {}  # sticker_id -> sticker data
var _categories: Array = []
var _unlocked_stickers: Dictionary = {}  # sticker_id -> true
var _is_loaded: bool = false


func _ready() -> void:
    _load_sticker_data()
    _load_unlocked_stickers()


func _load_sticker_data() -> void:
    if not FileAccess.file_exists(STICKERS_PATH):
        push_warning("StickerManager: Sticker data file not found: " + STICKERS_PATH)
        return
    
    var file := FileAccess.open(STICKERS_PATH, FileAccess.READ)
    if file == null:
        push_error("StickerManager: Failed to open sticker data: " + STICKERS_PATH)
        return
    
    var json := JSON.new()
    var parse_result := json.parse(file.get_as_text())
    file.close()
    
    if parse_result != OK:
        push_error("StickerManager: Failed to parse sticker data: " + json.get_error_message())
        return
    
    var data: Dictionary = json.data
    
    # Load stickers
    if data.has("stickers"):
        for sticker in data.stickers:
            _stickers[sticker.id] = sticker
            # Auto-unlock default stickers
            if sticker.get("unlocked_by_default", false):
                _unlocked_stickers[sticker.id] = true
    
    # Load categories
    if data.has("categories"):
        _categories = data.categories
    
    _is_loaded = true
    stickers_loaded.emit()


func _load_unlocked_stickers() -> void:
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
        for sticker_id in data.unlocked:
            _unlocked_stickers[sticker_id] = true


func _save_unlocked_stickers() -> void:
    var dir := DirAccess.open("user://")
    if dir == null:
        dir = DirAccess.open(".")
    
    var file := FileAccess.open(PERSISTENCE_PATH, FileAccess.WRITE)
    if file == null:
        push_error("StickerManager: Failed to save unlocked stickers")
        return
    
    var data := {
        "unlocked": _unlocked_stickers.keys()
    }
    file.store_string(JSON.stringify(data, "    "))
    file.close()


# Get all sticker data
func get_all_stickers() -> Array:
    return _stickers.values()


# Get sticker by ID
func get_sticker(sticker_id: String) -> Dictionary:
    return _stickers.get(sticker_id, {})


# Get all categories
func get_categories() -> Array:
    return _categories


# Get stickers by category
func get_stickers_by_category(category_id: String) -> Array:
    var result := []
    for sticker in _stickers.values():
        if sticker.get("category", "") == category_id:
            result.append(sticker)
    return result


# Check if sticker is unlocked
func is_sticker_unlocked(sticker_id: String) -> bool:
    return _unlocked_stickers.has(sticker_id)


# Get all unlocked stickers
func get_unlocked_stickers() -> Array:
    var result := []
    for sticker_id in _unlocked_stickers.keys():
        if _stickers.has(sticker_id):
            result.append(_stickers[sticker_id])
    return result


# Get unlocked stickers by category
func get_unlocked_stickers_by_category(category_id: String) -> Array:
    var result := []
    for sticker_id in _unlocked_stickers.keys():
        if _stickers.has(sticker_id):
            var sticker = _stickers[sticker_id]
            if sticker.get("category", "") == category_id:
                result.append(sticker)
    return result


# Unlock a sticker
func unlock_sticker(sticker_id: String) -> bool:
    if not _stickers.has(sticker_id):
        push_warning("StickerManager: Unknown sticker ID: " + sticker_id)
        return false
    
    if _unlocked_stickers.has(sticker_id):
        return false  # Already unlocked
    
    _unlocked_stickers[sticker_id] = true
    _save_unlocked_stickers()
    
    sticker_unlocked.emit(sticker_id, _stickers[sticker_id])
    return true


# Check unlock conditions and unlock eligible stickers
func check_unlock_conditions() -> void:
    for sticker_id in _stickers.keys():
        if _unlocked_stickers.has(sticker_id):
            continue  # Already unlocked
        
        var sticker = _stickers[sticker_id]
        if sticker.get("unlocked_by_default", false):
            unlock_sticker(sticker_id)
            continue
        
        var condition = sticker.get("unlock_condition", {})
        if condition.is_empty():
            continue
        
        if _check_condition(condition):
            unlock_sticker(sticker_id)


func _check_condition(condition: Dictionary) -> bool:
    var condition_type: String = condition.get("type", "")
    
    match condition_type:
        "collection":
            var category: String = condition.get("category", "")
            var count: int = condition.get("count", 1)
            if Engine.has_singleton("CollectionLogManager") or has_node("/root/CollectionLogManager"):
                var clm = get_node_or_null("/root/CollectionLogManager")
                if clm:
                    return clm.get_collected_count(category) >= count
            return false
        
        "photos_taken":
            var count: int = condition.get("count", 1)
            if Engine.has_singleton("PhotoModeManager") or has_node("/root/PhotoModeManager"):
                var pmm = get_node_or_null("/root/PhotoModeManager")
                if pmm and pmm.has_method("get_photo_count"):
                    return pmm.get_photo_count() >= count
            return false
        
        "quest_completed":
            var quest_id: String = condition.get("quest_id", "")
            if Engine.has_singleton("QuestManager") or has_node("/root/QuestManager"):
                var qm = get_node_or_null("/root/QuestManager")
                if qm:
                    return qm.is_quest_completed(quest_id)
            return false
        
        "story_flag":
            var flag: String = condition.get("flag", "")
            if Engine.has_singleton("InventoryManager") or has_node("/root/InventoryManager"):
                var im = get_node_or_null("/root/InventoryManager")
                if im:
                    return im.has_story_flag(flag)
            return false
        
        "area_visited":
            # For now, just check if story flag exists for visited area
            var area: String = condition.get("area", "")
            if Engine.has_singleton("InventoryManager") or has_node("/root/InventoryManager"):
                var im = get_node_or_null("/root/InventoryManager")
                if im:
                    return im.has_story_flag("visited_" + area)
            return false
    
    return false


# Get count of unlocked stickers
func get_unlocked_count() -> int:
    return _unlocked_stickers.size()


# Get total sticker count
func get_total_count() -> int:
    return _stickers.size()


# Reset all unlocks (for testing)
func reset_unlocks() -> void:
    _unlocked_stickers.clear()
    
    # Re-unlock defaults
    for sticker_id in _stickers.keys():
        var sticker = _stickers[sticker_id]
        if sticker.get("unlocked_by_default", false):
            _unlocked_stickers[sticker_id] = true
    
    _save_unlocked_stickers()


# Save/load for game saves
func get_save_data() -> Dictionary:
    return {
        "unlocked": _unlocked_stickers.keys()
    }


func load_save_data(data: Dictionary) -> void:
    if data.has("unlocked"):
        _unlocked_stickers.clear()
        for sticker_id in data.unlocked:
            _unlocked_stickers[sticker_id] = true
        
        # Ensure defaults are still unlocked
        for sticker_id in _stickers.keys():
            var sticker = _stickers[sticker_id]
            if sticker.get("unlocked_by_default", false):
                _unlocked_stickers[sticker_id] = true
