extends Node
## SceneRouter - handles area transitions and spawn placement

signal area_changing(from_area: String, to_area: String)
signal area_changed(area_path: String)

## Current area path
var current_area: String = ""
## Target spawn marker ID for next area load
var _pending_spawn_id: String = ""

func _ready() -> void:
    pass

## Transition to a new area, spawning player at the given marker ID
## Example: SceneRouter.go_to_area("res://game/scenes/areas/Forest.tscn", "from_town")
func go_to_area(area_path: String, spawn_marker_id: String = "default") -> void:
    var old_area := current_area
    _pending_spawn_id = spawn_marker_id
    
    area_changing.emit(old_area, area_path)
    
    # Change the scene
    var result := get_tree().change_scene_to_file(area_path)
    if result != OK:
        push_error("SceneRouter: Failed to load area '%s'" % area_path)
        return
    
	current_area = area_path
	# Spawning happens in _on_area_ready after scene loads
	
	# Advance time on area transition (simplified day/night progression)
	DayNightManager.advance_time()
	
	# Wait for scene to be ready, then place player
    await get_tree().process_frame
    await get_tree().process_frame
    _place_player_at_spawn()
    area_changed.emit(area_path)

## Called after area loads to place player at spawn marker
func _place_player_at_spawn() -> void:
    if _pending_spawn_id == "":
        return
    
    var player := _find_player()
    if player == null:
        push_warning("SceneRouter: No player found in scene")
        return
    
    var spawn := _find_spawn_marker(_pending_spawn_id)
    if spawn == null:
        push_warning("SceneRouter: Spawn marker '%s' not found, using default" % _pending_spawn_id)
        spawn = _find_spawn_marker("default")
    
    if spawn != null:
        player.global_position = spawn.global_position
    
    _pending_spawn_id = ""

func _find_player() -> Node2D:
    var root := get_tree().current_scene
    if root == null:
        return null
    # Look for node named "Player" or in group "player"
    var player := root.find_child("Player", true, false)
    if player != null:
        return player
    var players := get_tree().get_nodes_in_group("player")
    if players.size() > 0:
        return players[0]
    return null

func _find_spawn_marker(marker_id: String) -> Node2D:
    var spawns := get_tree().get_nodes_in_group("spawn_marker")
    for spawn in spawns:
        if spawn.has_method("get_marker_id"):
            if spawn.get_marker_id() == marker_id:
                return spawn
        elif spawn.name == marker_id:
            return spawn
    return null
