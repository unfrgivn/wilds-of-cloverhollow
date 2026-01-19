extends "res://addons/gut/test.gd"

const TOUCH_CONTROLS_SCRIPT = "res://game/scripts/ui/touch_controls.gd"

func test_vector_strengths_diagonal() -> void:
	var controls = load(TOUCH_CONTROLS_SCRIPT).new()
	var strengths = controls._vector_to_action_strengths(Vector2(1.0, -1.0))
	assert_eq(1.0, strengths["move_right"])
	assert_eq(1.0, strengths["move_up"])
	assert_eq(0.0, strengths["move_left"])
	assert_eq(0.0, strengths["move_down"])
	controls.free()
