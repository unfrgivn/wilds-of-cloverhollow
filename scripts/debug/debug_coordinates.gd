extends CanvasLayer
class_name DebugCoordinates
## Debug tool to output coordinates on mouse click
## Toggle with F3, click anywhere to log coordinates

var _enabled: bool = false
var _label: Label


func _ready() -> void:
	# Put on top of everything
	layer = 100
	
	# Create a label to show coordinates on screen
	_label = Label.new()
	_label.position = Vector2(10, 10)
	_label.add_theme_color_override("font_color", Color.YELLOW)
	_label.add_theme_color_override("font_shadow_color", Color.BLACK)
	_label.add_theme_constant_override("shadow_offset_x", 1)
	_label.add_theme_constant_override("shadow_offset_y", 1)
	_label.add_theme_font_size_override("font_size", 14)
	_label.visible = false
	add_child(_label)
	
	# Ensure we process input
	set_process_input(true)
	
	print("[DebugCoordinates] Press F3 to toggle coordinate debug mode")


func _input(event: InputEvent) -> void:
	# Toggle with F3
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F3 or event.physical_keycode == KEY_F3:
			_enabled = not _enabled
			_label.visible = _enabled
			if _enabled:
				_label.text = "DEBUG MODE\nClick anywhere..."
			print("[DebugCoordinates] %s" % ("ENABLED - Click to log coordinates" if _enabled else "DISABLED"))
			get_viewport().set_input_as_handled()
			return
	
	# Log coordinates on mouse click when enabled
	if _enabled and event is InputEventMouseButton and event.pressed:
		var viewport := get_viewport()
		var camera := viewport.get_camera_2d()
		
		# Get mouse position in world coordinates
		var screen_pos: Vector2 = event.position
		var world_pos: Vector2
		
		if camera:
			# Account for camera transform
			world_pos = camera.get_global_mouse_position()
		else:
			# Fallback to canvas transform
			world_pos = viewport.get_canvas_transform().affine_inverse() * screen_pos
		
		var button_name := _get_button_name(event.button_index)
		
		# Log to console
		print("[COORD] %s click at world: (%.0f, %.0f) | screen: (%.0f, %.0f)" % [
			button_name,
			world_pos.x, world_pos.y,
			screen_pos.x, screen_pos.y
		])
		
		# Update label
		_label.text = "World: (%.0f, %.0f)\nScreen: (%.0f, %.0f)\nClick for more..." % [
			world_pos.x, world_pos.y,
			screen_pos.x, screen_pos.y
		]


func _get_button_name(button_index: int) -> String:
	match button_index:
		MOUSE_BUTTON_LEFT:
			return "LEFT"
		MOUSE_BUTTON_RIGHT:
			return "RIGHT"
		MOUSE_BUTTON_MIDDLE:
			return "MIDDLE"
		_:
			return "BUTTON_%d" % button_index
