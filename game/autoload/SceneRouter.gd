extends Node
## SceneRouter - handles area transitions and spawn placement

signal area_changing(from_area: String, to_area: String)
signal area_changed(area_path: String)
signal transition_interrupted(from_area: String, to_area: String)
signal transition_recovered(area_path: String)

## Current area path
var current_area: String = ""
## Target spawn marker ID for next area load
var _pending_spawn_id: String = ""
## Track if a transition is in progress
var _transition_in_progress: bool = false
## Store the target area during transition for recovery
var _transition_target_area: String = ""
## Store if transition was interrupted (for testing)
var _was_interrupted: bool = false

func _ready() -> void:
    # Connect to app focus changes for interrupt detection
    get_tree().root.connect("focus_entered", _on_app_resumed)

func _notification(what: int) -> void:
    # Handle WM_NOTIFICATION_APPLICATION_RESUMED for mobile
    if what == NOTIFICATION_APPLICATION_RESUMED:
        _check_transition_state()

func _on_app_resumed() -> void:
    _check_transition_state()

## Check if we were mid-transition and recover if needed
func _check_transition_state() -> void:
    if _transition_in_progress:
        _was_interrupted = true
        transition_interrupted.emit(current_area, _transition_target_area)
        push_warning("SceneRouter: Transition interrupted, attempting recovery")
        # Complete the pending transition
        _recover_transition()

func _recover_transition() -> void:
    # If we have a pending target, try to complete it
    if _transition_target_area != "":
        var target := _transition_target_area
        var spawn_id := _pending_spawn_id
        # Reset state before attempting recovery
        _transition_in_progress = false
        _transition_target_area = ""
        # Attempt to complete the transition
        go_to_area(target, spawn_id)
        transition_recovered.emit(target)
    else:
        # No target - just reset the stuck state
        _transition_in_progress = false
        _pending_spawn_id = ""
        transition_recovered.emit(current_area)

## Transition to a new area, spawning player at the given marker ID
## Example: SceneRouter.go_to_area("res://game/scenes/areas/Forest.tscn", "from_town")
func go_to_area(area_path: String, spawn_marker_id: String = "default") -> void:
    var old_area := current_area
    _pending_spawn_id = spawn_marker_id
    _transition_in_progress = true
    _transition_target_area = area_path
    
    area_changing.emit(old_area, area_path)
    
    # Change the scene
    var result := get_tree().change_scene_to_file(area_path)
    if result != OK:
        push_error("SceneRouter: Failed to load area '%s'" % area_path)
        _transition_in_progress = false
        _transition_target_area = ""
        return
    
    current_area = area_path
    # Spawning happens in _on_area_ready after scene loads
    
    # Advance time on area transition (simplified day/night progression)
    DayNightManager.advance_time()
    
    # Wait for scene to be ready, then place player
    await get_tree().process_frame
    await get_tree().process_frame
    _place_player_at_spawn()
    
    # Transition complete
    _transition_in_progress = false
    _transition_target_area = ""
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

## Check if a transition is currently in progress
func is_transition_in_progress() -> bool:
    return _transition_in_progress

## Check if the last transition was interrupted and recovered
func was_interrupted() -> bool:
    return _was_interrupted

## Clear the interrupted flag (for testing)
func clear_interrupted_flag() -> void:
    _was_interrupted = false

## Simulate an interrupted transition for testing
## Sets the transition state as if we were mid-transition when app was backgrounded
func simulate_interrupt() -> void:
    if not _transition_in_progress:
        # Simulate being mid-transition to current area
        _transition_in_progress = true
        _transition_target_area = current_area
        _pending_spawn_id = "default"
        _check_transition_state()
