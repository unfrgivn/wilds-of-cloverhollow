extends Node
## SceneRouter - Handles scene transitions with fade and spawn point management

signal transition_started
signal transition_finished

# The spawn point ID to use when the next scene loads
var next_spawn_id: String = ""

# Reference to the fade overlay (set by Main.tscn or UIRoot)
var fade_overlay: ColorRect = null

# Transition settings
var fade_duration: float = 0.3
var is_transitioning: bool = false


func _ready() -> void:
	pass


## Transition to a new scene with fade
## target_scene: Path to the scene (e.g., "res://scenes/locations/Town.tscn")
## spawn_id: The SpawnPoint marker name in the target scene
func go_to_scene(target_scene: String, spawn_id: String = "") -> void:
	if is_transitioning:
		push_warning("[SceneRouter] Already transitioning, ignoring request")
		return
	
	is_transitioning = true
	next_spawn_id = spawn_id
	transition_started.emit()
	
	# Fade out
	if fade_overlay:
		await _fade_to_black()
	
	# Change scene
	var error := get_tree().change_scene_to_file(target_scene)
	if error != OK:
		push_error("[SceneRouter] Failed to change scene to: %s" % target_scene)
		is_transitioning = false
		return
	
	# Wait a frame for scene to initialize
	await get_tree().process_frame
	
	# Position player at spawn point (handled by the scene or player)
	# The player/scene should call get_and_clear_spawn_id() to get the spawn
	
	# Fade in
	if fade_overlay:
		await _fade_from_black()
	
	is_transitioning = false
	transition_finished.emit()


## Get the pending spawn ID and clear it
func get_and_clear_spawn_id() -> String:
	var spawn_id := next_spawn_id
	next_spawn_id = ""
	return spawn_id


## Set the fade overlay reference (call from Main or UIRoot)
func set_fade_overlay(overlay: ColorRect) -> void:
	fade_overlay = overlay


func _fade_to_black() -> void:
	if not fade_overlay:
		return
	var tween := create_tween()
	fade_overlay.modulate.a = 0.0
	fade_overlay.visible = true
	tween.tween_property(fade_overlay, "modulate:a", 1.0, fade_duration)
	await tween.finished


func _fade_from_black() -> void:
	if not fade_overlay:
		return
	var tween := create_tween()
	tween.tween_property(fade_overlay, "modulate:a", 0.0, fade_duration)
	await tween.finished
	fade_overlay.visible = false
