extends Node
## SaveManager - Handles save/load operations for player position, inventory, and story flags
## Supports multiple save slots (0, 1, 2)

const SAVE_DIR := "user://saves/"
const MAX_SLOTS := 3

signal save_completed(success: bool, slot: int)
signal load_completed(success: bool, slot: int)
signal save_deleted(slot: int)

## Save data structure version (for future migrations)
const SAVE_VERSION := 1

## Currently active slot
var current_slot: int = 0


func _ready() -> void:
    _ensure_save_dir()


func _ensure_save_dir() -> void:
    var dir := DirAccess.open("user://")
    if dir and not dir.dir_exists("saves"):
        dir.make_dir("saves")


func _get_slot_path(slot: int) -> String:
    return SAVE_DIR + "save_slot_%d.json" % slot


## Build save data from current game state
func _build_save_data() -> Dictionary:
    var player := _find_player()
    var player_pos := Vector2.ZERO
    if player:
        player_pos = player.global_position
    
    # Get area path - if in battle, use the return area
    var area_path: String = SceneRouter.current_area
    if BattleManager.in_battle and BattleManager._return_scene_path != "":
        area_path = BattleManager._return_scene_path
    
    return {
        "version": SAVE_VERSION,
        "timestamp": Time.get_unix_time_from_system(),
        "current_area": area_path,
        "player_position": {
            "x": player_pos.x,
            "y": player_pos.y
        },
        "inventory": InventoryManager.get_save_data(),
        "story_flags": InventoryManager.get_story_flags()
    }


## Save the current game state to a specific slot
func save_game(slot: int = -1) -> bool:
    if slot < 0:
        slot = current_slot
    
    if slot < 0 or slot >= MAX_SLOTS:
        push_error("[SaveManager] Invalid slot: %d" % slot)
        save_completed.emit(false, slot)
        return false
    
    var save_data := _build_save_data()
    var json_string := JSON.stringify(save_data, "\t")
    
    var path := _get_slot_path(slot)
    var file := FileAccess.open(path, FileAccess.WRITE)
    if file == null:
        push_error("[SaveManager] Failed to open save file for writing: %s" % FileAccess.get_open_error())
        save_completed.emit(false, slot)
        return false
    
    file.store_string(json_string)
    file.close()
    current_slot = slot
    print("[SaveManager] Game saved to slot %d" % slot)
    save_completed.emit(true, slot)
    return true


## Load game state from a specific slot
func load_game(slot: int = -1) -> bool:
    if slot < 0:
        slot = current_slot
    
    if slot < 0 or slot >= MAX_SLOTS:
        push_error("[SaveManager] Invalid slot: %d" % slot)
        load_completed.emit(false, slot)
        return false
    
    var path := _get_slot_path(slot)
    if not FileAccess.file_exists(path):
        push_warning("[SaveManager] No save file found at slot %d" % slot)
        load_completed.emit(false, slot)
        return false
    
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        push_error("[SaveManager] Failed to open save file: %s" % FileAccess.get_open_error())
        load_completed.emit(false, slot)
        return false
    
    var json_string := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var error := json.parse(json_string)
    if error != OK:
        push_error("[SaveManager] Failed to parse save file: %s" % json.get_error_message())
        load_completed.emit(false, slot)
        return false
    
    current_slot = slot
    var save_data: Dictionary = json.data
    return await _apply_save_data(save_data, slot)


## Apply loaded save data to game state
func _apply_save_data(save_data: Dictionary, slot: int) -> bool:
    # Version check for future migrations
    var version: int = save_data.get("version", 0)
    if version > SAVE_VERSION:
        push_error("[SaveManager] Save file version %d is newer than supported %d" % [version, SAVE_VERSION])
        load_completed.emit(false, slot)
        return false
    
    # Restore inventory and story flags first (before scene load)
    if save_data.has("inventory"):
        InventoryManager.load_save_data(save_data["inventory"])
    if save_data.has("story_flags"):
        InventoryManager.set_story_flags(save_data["story_flags"])
    
    # Load the saved area
    var area_path: String = save_data.get("current_area", "")
    if area_path == "":
        push_warning("[SaveManager] No area path in save data")
        load_completed.emit(false, slot)
        return false
    
    # Store position to restore after scene loads
    var pos_data: Dictionary = save_data.get("player_position", {})
    var saved_pos := Vector2(pos_data.get("x", 0), pos_data.get("y", 0))
    
    # Load the scene and restore player position
    var result := get_tree().change_scene_to_file(area_path)
    if result != OK:
        push_error("[SaveManager] Failed to load area: %s" % area_path)
        load_completed.emit(false, slot)
        return false
    
    SceneRouter.current_area = area_path
    
    # Wait for scene to load then position player
    await get_tree().process_frame
    await get_tree().process_frame
    
    var player := _find_player()
    if player:
        player.global_position = saved_pos
    
    print("[SaveManager] Game loaded from slot %d" % slot)
    load_completed.emit(true, slot)
    return true


## Check if a specific slot has a save file
func has_save(slot: int = -1) -> bool:
    if slot < 0:
        slot = current_slot
    if slot < 0 or slot >= MAX_SLOTS:
        return false
    return FileAccess.file_exists(_get_slot_path(slot))


## Get preview data for a slot (for slot selection UI)
func get_slot_preview(slot: int) -> Dictionary:
    if slot < 0 or slot >= MAX_SLOTS:
        return {}
    
    var path := _get_slot_path(slot)
    if not FileAccess.file_exists(path):
        return {"empty": true, "slot": slot}
    
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        return {"empty": true, "slot": slot}
    
    var json_string := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var error := json.parse(json_string)
    if error != OK:
        return {"empty": true, "slot": slot, "corrupted": true}
    
    var data: Dictionary = json.data
    var timestamp: int = int(data.get("timestamp", 0))
    var area: String = data.get("current_area", "Unknown")
    
    # Extract area name from path (e.g., "Area_TownCenter" from "res://game/scenes/areas/Area_TownCenter.tscn")
    var area_name := area.get_file().get_basename().replace("Area_", "").replace("_", " ")
    
    return {
        "empty": false,
        "slot": slot,
        "area_name": area_name,
        "timestamp": timestamp,
        "timestamp_formatted": _format_timestamp(timestamp),
    }


func _format_timestamp(unix_time: int) -> String:
    var dt := Time.get_datetime_dict_from_unix_time(unix_time)
    return "%04d-%02d-%02d %02d:%02d" % [dt.year, dt.month, dt.day, dt.hour, dt.minute]


## Get previews for all slots
func get_all_slot_previews() -> Array[Dictionary]:
    var previews: Array[Dictionary] = []
    for i in range(MAX_SLOTS):
        previews.append(get_slot_preview(i))
    return previews


## Delete a save file
func delete_save(slot: int) -> bool:
    if slot < 0 or slot >= MAX_SLOTS:
        return false
    
    var path := _get_slot_path(slot)
    if not FileAccess.file_exists(path):
        return true
    
    var dir := DirAccess.open(SAVE_DIR)
    if dir == null:
        return false
    
    var filename := "save_slot_%d.json" % slot
    var result := dir.remove(filename) == OK
    if result:
        print("[SaveManager] Deleted save slot %d" % slot)
        save_deleted.emit(slot)
    return result


## Check if any save slot has data
func has_any_save() -> bool:
    for i in range(MAX_SLOTS):
        if has_save(i):
            return true
    return false


## ============================================================================
## Cloud Sync Hooks (stubs for future implementation)
## ============================================================================

signal cloud_sync_started
signal cloud_sync_completed(success: bool)
signal cloud_conflict_detected(local_timestamp: int, cloud_timestamp: int)

## Whether cloud sync is enabled (future feature)
var cloud_sync_enabled: bool = false

## Cloud sync status
enum CloudSyncStatus { IDLE, SYNCING, ERROR, CONFLICT }
var cloud_sync_status: CloudSyncStatus = CloudSyncStatus.IDLE


## Upload local save to cloud (stub - no-op)
func cloud_upload(slot: int) -> bool:
    if not cloud_sync_enabled:
        print("[SaveManager] Cloud sync disabled, skipping upload")
        return false
    
    # TODO: Implement actual cloud upload (Game Center, iCloud, etc.)
    print("[SaveManager] Cloud upload stub for slot %d" % slot)
    cloud_sync_started.emit()
    
    # Simulate async operation completion
    cloud_sync_completed.emit(true)
    return true


## Download save from cloud (stub - no-op)
func cloud_download(slot: int) -> bool:
    if not cloud_sync_enabled:
        print("[SaveManager] Cloud sync disabled, skipping download")
        return false
    
    # TODO: Implement actual cloud download
    print("[SaveManager] Cloud download stub for slot %d" % slot)
    cloud_sync_started.emit()
    
    # Simulate async operation completion
    cloud_sync_completed.emit(true)
    return true


## Check if cloud has newer save (stub - always returns false)
func cloud_has_newer_save(slot: int) -> bool:
    if not cloud_sync_enabled:
        return false
    
    # TODO: Compare local timestamp with cloud timestamp
    print("[SaveManager] Cloud check stub for slot %d" % slot)
    return false


## Get save data as portable JSON string (for cloud upload)
func get_save_data_json(slot: int) -> String:
    var path := _get_slot_path(slot)
    if not FileAccess.file_exists(path):
        return ""
    
    var file := FileAccess.open(path, FileAccess.READ)
    if file == null:
        return ""
    
    var json_string := file.get_as_text()
    file.close()
    return json_string


## Import save data from JSON string (for cloud download)
func import_save_data_json(slot: int, json_string: String) -> bool:
    if slot < 0 or slot >= MAX_SLOTS:
        return false
    
    # Validate JSON
    var json := JSON.new()
    var error := json.parse(json_string)
    if error != OK:
        push_error("[SaveManager] Invalid JSON for import: %s" % json.get_error_message())
        return false
    
    # Validate required fields
    var data: Dictionary = json.data
    if not data.has("version") or not data.has("timestamp"):
        push_error("[SaveManager] Missing required fields in imported save")
        return false
    
    # Write to slot
    var path := _get_slot_path(slot)
    var file := FileAccess.open(path, FileAccess.WRITE)
    if file == null:
        return false
    
    file.store_string(json_string)
    file.close()
    print("[SaveManager] Imported save to slot %d" % slot)
    return true


func _find_player() -> Node2D:
    var root := get_tree().current_scene
    if root == null:
        return null
    var player := root.find_child("Player", true, false)
    if player != null:
        return player
    var players := get_tree().get_nodes_in_group("player")
    if players.size() > 0:
        return players[0]
    return null
