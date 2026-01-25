extends Control
## Touch button that triggers the "interact" action when pressed.

signal button_pressed

@onready var button_visual: ColorRect = $ButtonVisual


func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var touch := event as InputEventScreenTouch
		if touch.pressed:
			_on_pressed()


func _on_pressed() -> void:
	button_pressed.emit()
	# Inject the interact action
	Input.action_press("interact")
	# Release after a short delay so it registers as a press
	await get_tree().create_timer(0.1).timeout
	Input.action_release("interact")
