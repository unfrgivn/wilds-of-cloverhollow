extends Node

signal transition_started(scene_path: String, spawn_id: String)
signal transition_completed(scene_path: String, spawn_id: String)

@export var fade_duration := 0.2
@export var fade_color := Color(0, 0, 0, 1)

var _is_transitioning := false
var _fade_layer: CanvasLayer
var _fade_rect: ColorRect

@onready var _game_state = get_node_or_null("/root/GameState")


func _ready() -> void:
	_setup_fade_overlay()


func goto_scene(scene_path: String, spawn_id: String = "") -> void:
	if scene_path.is_empty():
		push_error("SceneRouter.goto_scene missing scene path")
		return
	if _is_transitioning:
		return
	call_deferred("_begin_transition", scene_path, spawn_id)


func _begin_transition(scene_path: String, spawn_id: String) -> void:
	_is_transitioning = true
	if _game_state != null:
		_game_state.input_blocked = true
		_game_state.set_value("last_scene_path", scene_path)
		_game_state.set_value("last_spawn_id", spawn_id)
	transition_started.emit(scene_path, spawn_id)
	await _fade_to(1.0)
	await _change_scene(scene_path, spawn_id)
	await _fade_to(0.0)
	if _game_state != null:
		_game_state.input_blocked = false
	_is_transitioning = false
	transition_completed.emit(scene_path, spawn_id)


func _setup_fade_overlay() -> void:
	if _fade_layer != null:
		return
	_fade_layer = CanvasLayer.new()
	_fade_layer.layer = 100
	_fade_rect = ColorRect.new()
	_fade_rect.color = fade_color
	_fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_rect.modulate.a = 0.0
	_fade_layer.add_child(_fade_rect)
	get_tree().root.call_deferred("add_child", _fade_layer)


func _fade_to(target_alpha: float) -> void:
	_setup_fade_overlay()
	var tween = create_tween()
	tween.tween_property(_fade_rect, "modulate:a", target_alpha, fade_duration)
	await tween.finished


func _change_scene(scene_path: String, spawn_id: String) -> void:
	var tree = get_tree()
	tree.change_scene_to_file(scene_path)
	await tree.process_frame
	await tree.process_frame
	_apply_spawn(spawn_id)


func _apply_spawn(spawn_id: String) -> void:
	var root = get_tree().current_scene
	if root == null:
		return
	var player = _find_player(root)
	if player == null:
		return
	var marker = _find_spawn_marker(root, spawn_id)
	if marker == null and spawn_id.is_empty():
		marker = _find_default_spawn_marker(root)
	if marker == null:
		return
	player.global_position = marker.global_position


func _find_spawn_marker(root: Node, spawn_id: String) -> Node3D:
	if spawn_id.is_empty():
		return null
	var markers = root.find_children("", "SpawnMarker", true, false)
	for marker in markers:
		if marker.spawn_id == spawn_id:
			return marker
	return null


func _find_default_spawn_marker(root: Node) -> Node3D:
	var markers = root.find_children("", "SpawnMarker", true, false)
	for marker in markers:
		if marker.is_default:
			return marker
	return null


func _find_player(root: Node) -> Node3D:
	if root.has_node("Player"):
		return root.get_node("Player")
	return root.find_child("Player", true, false)
