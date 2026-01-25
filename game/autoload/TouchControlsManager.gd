extends Node
## TouchControlsManager autoload.
## Automatically injects touch controls into the scene tree when on mobile.
## Controls are shown in overworld areas and hidden during battles/menus.

const TOUCH_CONTROLS_SCENE := preload("res://game/scenes/ui/TouchControls.tscn")

var _touch_controls: CanvasLayer = null
var _is_mobile: bool = false


func _ready() -> void:
	# Detect if we're on mobile (iOS/Android) or if touch is emulated
	_is_mobile = _detect_mobile()
	if _is_mobile:
		_spawn_touch_controls()


func _detect_mobile() -> bool:
	# Check platform
	var os_name := OS.get_name()
	if os_name in ["iOS", "Android"]:
		return true
	# Also enable if touch screen is available (for testing on desktop)
	if DisplayServer.is_touchscreen_available():
		return true
	return false


func _spawn_touch_controls() -> void:
	if _touch_controls != null:
		return
	_touch_controls = TOUCH_CONTROLS_SCENE.instantiate()
	add_child(_touch_controls)


func show_controls() -> void:
	if _touch_controls:
		_touch_controls.visible = true


func hide_controls() -> void:
	if _touch_controls:
		_touch_controls.visible = false


func is_mobile() -> bool:
	return _is_mobile
