extends CanvasLayer

const LABEL_OFFSET := Vector3.UP * 1.5
const LABEL_COLOR := Color(1.0, 0.95, 0.2)
const LABEL_SHADOW := Color(0.0, 0.0, 0.0, 0.8)
const TOWN_SCENE_PATH := "res://game/scenes/areas/cloverhollow/Area_Cloverhollow_Town.tscn"
const LABEL_ROOT_NAMES := ["Buildings", "Landmarks", "Decor"]

var _enabled := false
var _labels: Dictionary = {}
var _root: Control
var _cached_scene: Node
var _cached_scene_nodes: Array[Node3D] = []


func _ready() -> void:
	layer = 100
	_root = Control.new()
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_root)
	_set_enabled(false)


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F2:
		_set_enabled(not _enabled)
		get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
	if not _enabled:
		return
	var camera = get_viewport().get_camera_3d()
	if camera == null:
		return
	var targets = _get_target_nodes()
	var seen: Dictionary = {}
	for target in targets:
		if not is_instance_valid(target):
			continue
		var id = target.get_instance_id()
		seen[id] = true
		var label = _labels.get(id)
		if label == null:
			label = _make_label()
			_labels[id] = label
			_root.add_child(label)
		label.text = target.name
		var world_pos = target.global_position + LABEL_OFFSET
		var is_visible = camera.is_position_in_frustum(world_pos) and not camera.is_position_behind(world_pos)
		label.visible = is_visible
		if is_visible:
			label.position = camera.unproject_position(world_pos)
	_cleanup_labels(seen)


func _get_target_nodes() -> Array[Node3D]:
	var current_scene = get_tree().current_scene
	if current_scene == null:
		return _collect_interactables()
	if current_scene.scene_file_path == TOWN_SCENE_PATH:
		if current_scene != _cached_scene:
			_cached_scene = current_scene
			_cached_scene_nodes = _collect_scene_nodes(current_scene)
		return _cached_scene_nodes
	return _collect_interactables()


func _should_label(node: Node) -> bool:
	if not (node is Node3D):
		return false
	if node is MeshInstance3D:
		return false
	if node is AnimatedSprite3D:
		return false
	if node is CollisionShape3D:
		return false
	if LABEL_ROOT_NAMES.has(node.name):
		return false
	if node.is_in_group("interactable"):
		return true
	if node.name.begins_with("NPC"):
		return true
	if _has_named_ancestor(node):
		return true
	return false


func _has_named_ancestor(node: Node) -> bool:
	var current = node.get_parent()
	while current != null:
		if LABEL_ROOT_NAMES.has(current.name):
			return true
		current = current.get_parent()
	return false


func _collect_scene_nodes(root: Node) -> Array[Node3D]:
	var nodes: Array[Node3D] = []
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node = stack.pop_back()
		if _should_label(node):
			nodes.append(node)
		for child in node.get_children():
			if child is Node:
				stack.append(child)
	return nodes


func _collect_interactables() -> Array[Node3D]:
	var nodes: Array[Node3D] = []
	for interactable in get_tree().get_nodes_in_group("interactable"):
		if is_instance_valid(interactable) and _should_label(interactable):
			nodes.append(interactable)
	return nodes


func _make_label() -> Label:
	var label = Label.new()
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	label.add_theme_color_override("font_color", LABEL_COLOR)
	label.add_theme_color_override("font_shadow_color", LABEL_SHADOW)
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)
	return label


func _cleanup_labels(seen: Dictionary) -> void:
	for id in _labels.keys():
		if not seen.has(id):
			var label = _labels[id]
			if is_instance_valid(label):
				label.queue_free()
			_labels.erase(id)


func _clear_labels() -> void:
	for label in _labels.values():
		if is_instance_valid(label):
			label.queue_free()
	_labels.clear()


func _set_enabled(enabled: bool) -> void:
	_enabled = enabled
	if _root != null:
		_root.visible = enabled
	set_process(enabled)
	if not enabled:
		_clear_labels()
