extends "res://addons/gut/test.gd"

var dialogue_line_script = load("res://game/scripts/ui/dialogue_line.gd")

func test_dialogue_resource_creation():
	var line = dialogue_line_script.new()
	line.text = "Test"
	line.speaker_name = "Fae"
	assert_eq(line.text, "Test")
	assert_eq(line.speaker_name, "Fae")
