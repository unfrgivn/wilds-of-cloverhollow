extends CanvasLayer

const LABEL_OFFSET := Vector3.UP * 1.5
const LABEL_COLOR := Color(1.0, 0.95, 0.2)
const LABEL_SHADOW := Color(0.0, 0.0, 0.0, 0.8)

var _enabled := false
var _labels: Dictionary = {}
var _root: Control


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
	var interactables = get_tree().get_nodes_in_group("interactable")
	var seen: Dictionary = {}
	for interactable in interactables:
		if not is_instance_valid(interactable):
			continue
		if not (interactable is Node3D):
			continue
		var id = interactable.get_instance_id()
		seen[id] = true
		var label = _labels.get(id)
		if label == null:
			label = _make_label()
			_labels[id] = label
			_root.add_child(label)
		label.text = interactable.name
		var world_pos = interactable.global_position + LABEL_OFFSET
		var is_visible = camera.is_position_in_frustum(world_pos) and not camera.is_position_behind(world_pos)
		label.visible = is_visible
		if is_visible:
			label.position = camera.unproject_position(world_pos)
	_cleanup_labels(seen)


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
