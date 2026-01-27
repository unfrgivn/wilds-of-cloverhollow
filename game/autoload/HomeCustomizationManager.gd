extends Node
# HomeCustomizationManager - Manages room furniture placement and persistence

signal furniture_placed(room_id: String, furniture_id: String, position: Vector2i)
signal furniture_removed(room_id: String, furniture_id: String)
signal furniture_unlocked(furniture_id: String)
signal room_state_changed(room_id: String)
signal furniture_data_loaded

const FURNITURE_PATH := "res://game/data/furniture/furniture.json"
const PERSISTENCE_PATH := "user://home_customization.json"

var _furniture: Dictionary = {}  # furniture_id -> furniture data
var _categories: Array = []
var _rooms: Dictionary = {}  # room_id -> room data
var _unlocked_furniture: Dictionary = {}  # furniture_id -> true
var _room_placements: Dictionary = {}  # room_id -> Array[{furniture_id, position}]
var _is_loaded: bool = false


func _ready() -> void:
    _load_furniture_data()
    _load_persistent_state()


func _load_furniture_data() -> void:
    if not FileAccess.file_exists(FURNITURE_PATH):
        push_warning("HomeCustomizationManager: Furniture data file not found: " + FURNITURE_PATH)
        return
    
    var file := FileAccess.open(FURNITURE_PATH, FileAccess.READ)
    if file == null:
        push_error("HomeCustomizationManager: Failed to open furniture data: " + FURNITURE_PATH)
        return
    
    var json := JSON.new()
    var parse_result := json.parse(file.get_as_text())
    file.close()
    
    if parse_result != OK:
        push_error("HomeCustomizationManager: Failed to parse furniture data: " + json.get_error_message())
        return
    
    var data: Dictionary = json.data
    
    # Load furniture
    if data.has("furniture"):
        for furn in data.furniture:
            _furniture[furn.id] = furn
            # Auto-unlock default furniture
            if furn.get("unlocked_by_default", false):
                _unlocked_furniture[furn.id] = true
    
    # Load categories
    if data.has("categories"):
        _categories = data.categories
    
    # Load rooms
    if data.has("rooms"):
        for room in data.rooms:
            _rooms[room.id] = room
            if not _room_placements.has(room.id):
                _room_placements[room.id] = []
    
    _is_loaded = true
    furniture_data_loaded.emit()


func _load_persistent_state() -> void:
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
        for furn_id in data.unlocked:
            _unlocked_furniture[furn_id] = true
    
    if data.has("placements"):
        for room_id in data.placements.keys():
            _room_placements[room_id] = []
            for placement in data.placements[room_id]:
                _room_placements[room_id].append({
                    "furniture_id": placement.furniture_id,
                    "position": Vector2i(placement.position[0], placement.position[1])
                })


func _save_persistent_state() -> void:
    var file := FileAccess.open(PERSISTENCE_PATH, FileAccess.WRITE)
    if file == null:
        push_error("HomeCustomizationManager: Failed to save persistent state")
        return
    
    var placements_data := {}
    for room_id in _room_placements.keys():
        placements_data[room_id] = []
        for placement in _room_placements[room_id]:
            placements_data[room_id].append({
                "furniture_id": placement.furniture_id,
                "position": [placement.position.x, placement.position.y]
            })
    
    var data := {
        "unlocked": _unlocked_furniture.keys(),
        "placements": placements_data
    }
    file.store_string(JSON.stringify(data, "    "))
    file.close()


# Get all furniture data
func get_all_furniture() -> Array:
    return _furniture.values()


# Get furniture by ID
func get_furniture(furniture_id: String) -> Dictionary:
    return _furniture.get(furniture_id, {})


# Get all categories
func get_categories() -> Array:
    return _categories


# Get furniture by category
func get_furniture_by_category(category_id: String) -> Array:
    var result := []
    for furn in _furniture.values():
        if furn.get("category", "") == category_id:
            result.append(furn)
    return result


# Check if furniture is unlocked
func is_furniture_unlocked(furniture_id: String) -> bool:
    return _unlocked_furniture.has(furniture_id)


# Get all unlocked furniture
func get_unlocked_furniture() -> Array:
    var result := []
    for furn_id in _unlocked_furniture.keys():
        if _furniture.has(furn_id):
            result.append(_furniture[furn_id])
    return result


# Unlock furniture
func unlock_furniture(furniture_id: String) -> bool:
    if not _furniture.has(furniture_id):
        push_warning("HomeCustomizationManager: Unknown furniture ID: " + furniture_id)
        return false
    
    if _unlocked_furniture.has(furniture_id):
        return false  # Already unlocked
    
    _unlocked_furniture[furniture_id] = true
    _save_persistent_state()
    
    furniture_unlocked.emit(furniture_id)
    return true


# Place furniture in a room
func place_furniture(room_id: String, furniture_id: String, position: Vector2i) -> bool:
    if not _rooms.has(room_id):
        push_warning("HomeCustomizationManager: Unknown room ID: " + room_id)
        return false
    
    if not _furniture.has(furniture_id):
        push_warning("HomeCustomizationManager: Unknown furniture ID: " + furniture_id)
        return false
    
    if not _unlocked_furniture.has(furniture_id):
        push_warning("HomeCustomizationManager: Furniture not unlocked: " + furniture_id)
        return false
    
    # Check bounds
    var room = _rooms[room_id]
    var furn = _furniture[furniture_id]
    var furn_size = furn.get("size", {"width": 1, "height": 1})
    var grid_size = room.get("grid_size", {"width": 8, "height": 6})
    
    if position.x < 0 or position.y < 0:
        return false
    if position.x + furn_size.width > grid_size.width:
        return false
    if position.y + furn_size.height > grid_size.height:
        return false
    
    # Add placement
    if not _room_placements.has(room_id):
        _room_placements[room_id] = []
    
    _room_placements[room_id].append({
        "furniture_id": furniture_id,
        "position": position
    })
    
    _save_persistent_state()
    furniture_placed.emit(room_id, furniture_id, position)
    room_state_changed.emit(room_id)
    return true


# Remove furniture from a room
func remove_furniture(room_id: String, placement_index: int) -> bool:
    if not _room_placements.has(room_id):
        return false
    
    if placement_index < 0 or placement_index >= _room_placements[room_id].size():
        return false
    
    var placement = _room_placements[room_id][placement_index]
    _room_placements[room_id].remove_at(placement_index)
    
    _save_persistent_state()
    furniture_removed.emit(room_id, placement.furniture_id)
    room_state_changed.emit(room_id)
    return true


# Get all placements in a room
func get_room_placements(room_id: String) -> Array:
    return _room_placements.get(room_id, [])


# Get room data
func get_room(room_id: String) -> Dictionary:
    return _rooms.get(room_id, {})


# Clear all furniture from a room
func clear_room(room_id: String) -> void:
    if _room_placements.has(room_id):
        _room_placements[room_id].clear()
        _save_persistent_state()
        room_state_changed.emit(room_id)


# Get count of unlocked furniture
func get_unlocked_count() -> int:
    return _unlocked_furniture.size()


# Get total furniture count
func get_total_count() -> int:
    return _furniture.size()


# Reset all customization (for testing)
func reset_all() -> void:
    _unlocked_furniture.clear()
    _room_placements.clear()
    
    # Re-unlock defaults
    for furn_id in _furniture.keys():
        var furn = _furniture[furn_id]
        if furn.get("unlocked_by_default", false):
            _unlocked_furniture[furn_id] = true
    
    # Initialize empty room placements
    for room_id in _rooms.keys():
        _room_placements[room_id] = []
    
    _save_persistent_state()


# Save/load for game saves
func get_save_data() -> Dictionary:
    var placements_data := {}
    for room_id in _room_placements.keys():
        placements_data[room_id] = []
        for placement in _room_placements[room_id]:
            placements_data[room_id].append({
                "furniture_id": placement.furniture_id,
                "position": [placement.position.x, placement.position.y]
            })
    
    return {
        "unlocked": _unlocked_furniture.keys(),
        "placements": placements_data
    }


func load_save_data(data: Dictionary) -> void:
    if data.has("unlocked"):
        _unlocked_furniture.clear()
        for furn_id in data.unlocked:
            _unlocked_furniture[furn_id] = true
        
        # Ensure defaults are still unlocked
        for furn_id in _furniture.keys():
            var furn = _furniture[furn_id]
            if furn.get("unlocked_by_default", false):
                _unlocked_furniture[furn_id] = true
    
    if data.has("placements"):
        _room_placements.clear()
        for room_id in data.placements.keys():
            _room_placements[room_id] = []
            for placement in data.placements[room_id]:
                _room_placements[room_id].append({
                    "furniture_id": placement.furniture_id,
                    "position": Vector2i(placement.position[0], placement.position[1])
                })
