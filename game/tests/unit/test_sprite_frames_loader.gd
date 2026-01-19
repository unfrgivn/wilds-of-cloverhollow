extends "res://addons/gut/test.gd"

var loader_script = preload("res://game/scripts/exploration/sprite_frames_loader.gd")


func test_loads_fae_sprite_frames() -> void:
	var frames = loader_script.build_frames("res://game/assets/sprites/characters/fae", "fae")
	assert_true(frames != null)
	assert_true(frames.has_animation("idle_s"))
	assert_true(frames.has_animation("walk_s"))
	assert_true(frames.get_frame_count("idle_s") > 0)
	assert_true(frames.get_frame_count("walk_s") > 0)
