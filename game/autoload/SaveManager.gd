extends Node
## SaveManager - Handles save/load operations for player position, inventory, and story flags

const SAVE_DIR := "user://saves/"
const SAVE_FILE := "save_slot_0.json"

signal save_completed(success: bool)
signal load_completed(success: bool)

## Save data structure version (for future migrations)
const SAVE_VERSION := 1

func _ready() -> void:
	_ensure_save_dir()

func _ensure_save_dir() -> void:
	var dir := DirAccess.open("user://")
	if dir and not dir.dir_exists("saves"):
		dir.make_dir("saves")

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

## Save the current game state to file
func save_game() -> bool:
	var save_data := _build_save_data()
	var json_string := JSON.stringify(save_data, "\t")
	
	var file := FileAccess.open(SAVE_DIR + SAVE_FILE, FileAccess.WRITE)
	if file == null:
		push_error("[SaveManager] Failed to open save file for writing: %s" % FileAccess.get_open_error())
		save_completed.emit(false)
		return false
	
	file.store_string(json_string)
	file.close()
	print("[SaveManager] Game saved successfully")
	save_completed.emit(true)
	return true

## Load game state from file
func load_game() -> bool:
	var path := SAVE_DIR + SAVE_FILE
	if not FileAccess.file_exists(path):
		push_warning("[SaveManager] No save file found at: %s" % path)
		load_completed.emit(false)
		return false
	
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		push_error("[SaveManager] Failed to open save file: %s" % FileAccess.get_open_error())
		load_completed.emit(false)
		return false
	
	var json_string := file.get_as_text()
	file.close()
	
	var json := JSON.new()
	var error := json.parse(json_string)
	if error != OK:
		push_error("[SaveManager] Failed to parse save file: %s" % json.get_error_message())
		load_completed.emit(false)
		return false
	
	var save_data: Dictionary = json.data
	return await _apply_save_data(save_data)

## Apply loaded save data to game state
func _apply_save_data(save_data: Dictionary) -> bool:
	# Version check for future migrations
	var version: int = save_data.get("version", 0)
	if version > SAVE_VERSION:
		push_error("[SaveManager] Save file version %d is newer than supported %d" % [version, SAVE_VERSION])
		load_completed.emit(false)
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
		load_completed.emit(false)
		return false
	
	# Store position to restore after scene loads
	var pos_data: Dictionary = save_data.get("player_position", {})
	var saved_pos := Vector2(pos_data.get("x", 0), pos_data.get("y", 0))
	
	# Load the scene and restore player position
	var result := get_tree().change_scene_to_file(area_path)
	if result != OK:
		push_error("[SaveManager] Failed to load area: %s" % area_path)
		load_completed.emit(false)
		return false
	
	SceneRouter.current_area = area_path
	
	# Wait for scene to load then position player
	await get_tree().process_frame
	await get_tree().process_frame
	
	var player := _find_player()
	if player:
		player.global_position = saved_pos
	
	print("[SaveManager] Game loaded successfully")
	load_completed.emit(true)
	return true

## Check if a save file exists
func has_save() -> bool:
	return FileAccess.file_exists(SAVE_DIR + SAVE_FILE)

## Delete the save file
func delete_save() -> bool:
	var path := SAVE_DIR + SAVE_FILE
	if not FileAccess.file_exists(path):
		return true
	var dir := DirAccess.open(SAVE_DIR)
	if dir == null:
		return false
	return dir.remove(SAVE_FILE) == OK

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
