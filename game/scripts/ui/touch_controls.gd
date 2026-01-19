extends CanvasLayer

@export var force_visible := false
@export var joystick_deadzone := 0.05

@onready var safe_area: MarginContainer = $SafeArea
@onready var joystick: Control = $SafeArea/Layout/Joystick
@onready var action_button: Button = $SafeArea/Layout/ActionButton

var _last_strengths := {
	"move_left": 0.0,
	"move_right": 0.0,
	"move_up": 0.0,
	"move_down": 0.0,
}

func _ready() -> void:
	visible = _should_show()
	if not visible:
		_release_actions()
		return
	_update_safe_area()
	get_tree().root.size_changed.connect(_update_safe_area)
	if joystick != null and joystick.has_signal("vector_changed"):
		joystick.vector_changed.connect(_on_joystick_vector)
	if action_button != null:
		action_button.button_down.connect(_on_action_down)
		action_button.button_up.connect(_on_action_up)

func _exit_tree() -> void:
	_release_actions()

func _should_show() -> bool:
	if force_visible:
		return true
	if DisplayServer.get_name() == "headless":
		return false
	if OS.has_feature("mobile"):
		return true
	return _has_cmdline_flag("--touch_controls")

func _has_cmdline_flag(flag: String) -> bool:
	var args = OS.get_cmdline_user_args()
	for arg in args:
		if arg == flag:
			return true
		if arg.begins_with(flag + "="):
			return true
	return false

func _update_safe_area() -> void:
	var safe_rect = DisplayServer.get_display_safe_area()
	var window_size = DisplayServer.window_get_size()
	if safe_area == null:
		return
	
	safe_area.add_theme_constant_override("margin_left", safe_rect.position.x + 20)
	safe_area.add_theme_constant_override("margin_top", safe_rect.position.y + 20)
	safe_area.add_theme_constant_override("margin_right", window_size.x - (safe_rect.position.x + safe_rect.size.x) + 20)
	safe_area.add_theme_constant_override("margin_bottom", window_size.y - (safe_rect.position.y + safe_rect.size.y) + 20)

func _on_joystick_vector(vector: Vector2) -> void:
	var adjusted = vector
	if adjusted.length() < joystick_deadzone:
		adjusted = Vector2.ZERO
	_apply_action_strengths(_vector_to_action_strengths(adjusted))

func _vector_to_action_strengths(vector: Vector2) -> Dictionary:
	return {
		"move_left": maxf(-vector.x, 0.0),
		"move_right": maxf(vector.x, 0.0),
		"move_up": maxf(-vector.y, 0.0),
		"move_down": maxf(vector.y, 0.0),
	}

func _apply_action_strengths(strengths: Dictionary) -> void:
	for action in _last_strengths.keys():
		var strength = float(strengths.get(action, 0.0))
		if strength > 0.0:
			Input.action_press(action, strength)
		else:
			Input.action_release(action)
		_last_strengths[action] = strength

func _release_actions() -> void:
	for action in _last_strengths.keys():
		Input.action_release(action)
		_last_strengths[action] = 0.0

func _on_action_down() -> void:
	Input.action_press("interact")

func _on_action_up() -> void:
	Input.action_release("interact")
