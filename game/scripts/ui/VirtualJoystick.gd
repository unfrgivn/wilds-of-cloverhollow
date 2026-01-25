extends Control
## Virtual joystick for touch movement input.
## Emits movement as a Vector2 via the joystick_input signal.
## Also injects input actions so Player.gd's Input.get_vector() works.

signal joystick_input(direction: Vector2)

@export var joystick_radius: float = 50.0
@export var knob_radius: float = 20.0
@export var dead_zone: float = 0.15

var _is_pressed: bool = false
var _touch_index: int = -1
var _knob_position: Vector2 = Vector2.ZERO
var _center_position: Vector2 = Vector2.ZERO

@onready var background: ColorRect = $Background
@onready var knob: ColorRect = $Knob


func _ready() -> void:
	_center_position = size / 2.0
	_update_knob_visual()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_is_pressed = true
			_touch_index = touch.index
			_update_joystick(touch.position)
		elif touch.index == _touch_index:
			_release_joystick()
	elif event is InputEventScreenDrag:
		var drag := event as InputEventScreenDrag
		if drag.index == _touch_index and _is_pressed:
			_update_joystick(drag.position)


func _update_joystick(touch_pos: Vector2) -> void:
	var offset := touch_pos - _center_position
	var clamped := offset
	if offset.length() > joystick_radius:
		clamped = offset.normalized() * joystick_radius
	_knob_position = clamped
	_update_knob_visual()
	
	var direction := clamped / joystick_radius
	if direction.length() < dead_zone:
		direction = Vector2.ZERO
	
	joystick_input.emit(direction)
	_inject_movement_input(direction)


func _release_joystick() -> void:
	_is_pressed = false
	_touch_index = -1
	_knob_position = Vector2.ZERO
	_update_knob_visual()
	joystick_input.emit(Vector2.ZERO)
	_inject_movement_input(Vector2.ZERO)


func _update_knob_visual() -> void:
	if knob:
		knob.position = _center_position + _knob_position - Vector2(knob_radius, knob_radius)


func _inject_movement_input(direction: Vector2) -> void:
	# Inject fake action strengths so Input.get_vector() picks them up.
	# This is a simple approach; for production you might use Input.parse_input_event.
	Input.action_release("ui_left")
	Input.action_release("ui_right")
	Input.action_release("ui_up")
	Input.action_release("ui_down")
	
	if direction.x < 0:
		Input.action_press("ui_left", absf(direction.x))
	elif direction.x > 0:
		Input.action_press("ui_right", absf(direction.x))
	
	if direction.y < 0:
		Input.action_press("ui_up", absf(direction.y))
	elif direction.y > 0:
		Input.action_press("ui_down", absf(direction.y))
