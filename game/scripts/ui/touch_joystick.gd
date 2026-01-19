extends Control

signal vector_changed(vector: Vector2)

@export var radius := 80.0
@export var allow_mouse := true

@onready var knob: Control = $Knob
@onready var base: Control = $Base

var _active_id := -1
var _vector := Vector2.ZERO
var _center := Vector2.ZERO

func _ready() -> void:
	_update_center()
	resized.connect(_update_center)
	_apply_knob_position()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_screen_touch(event)
		return
	if event is InputEventScreenDrag:
		_handle_screen_drag(event)
		return
	if allow_mouse:
		_handle_mouse(event)

func _handle_screen_touch(event: InputEventScreenTouch) -> void:
	if event.pressed:
		if _active_id == -1 and _is_within(event.position):
			_active_id = event.index
			_update_vector(event.position)
		return
	if event.index == _active_id:
		_reset()

func _handle_screen_drag(event: InputEventScreenDrag) -> void:
	if event.index == _active_id:
		_update_vector(event.position)

func _handle_mouse(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			if _active_id == -1 and _is_within(event.position):
				_active_id = -2
				_update_vector(event.position)
			return
		if _active_id == -2:
			_reset()
		return
	if event is InputEventMouseMotion and _active_id == -2:
		_update_vector(event.position)

func _reset() -> void:
	_active_id = -1
	_set_vector(Vector2.ZERO)

func _update_center() -> void:
	_center = size * 0.5
	_apply_knob_position()

func _is_within(point: Vector2) -> bool:
	if size == Vector2.ZERO:
		return false
	return point.distance_to(_center) <= radius

func _update_vector(point: Vector2) -> void:
	if radius <= 0.0:
		_set_vector(Vector2.ZERO)
		return
	var delta = point - _center
	var length = delta.length()
	if length > radius:
		delta = delta / length * radius
	_set_vector(delta / radius)

func _set_vector(next_vector: Vector2) -> void:
	var clamped = next_vector.limit_length(1.0)
	if _vector == clamped:
		return
	_vector = clamped
	_apply_knob_position()
	vector_changed.emit(_vector)

func _apply_knob_position() -> void:
	if knob == null:
		return
	var knob_size = knob.size
	knob.position = _center + (_vector * radius) - (knob_size * 0.5)

func get_vector() -> Vector2:
	return _vector
