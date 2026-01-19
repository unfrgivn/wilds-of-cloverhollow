extends "res://addons/gut/test.gd"

var loader_script = preload("res://game/scripts/battle/battle_background_loader.gd")

func test_fallback_when_missing() -> void:
	var loader = loader_script.new()
	var result = loader.load_background("missing", "missing")
	assert_true(result.get("fallback", false))
	assert_true(result.get("bg", null) != null)


func test_defaults_use_cloverhollow_paths() -> void:
	var loader = loader_script.new()
	var result = loader.load_background("", "")
	assert_eq("res://game/assets/battle_backgrounds/cloverhollow/default/bg.png", result.get("bg_path", ""))
	assert_eq("res://game/assets/battle_backgrounds/cloverhollow/default/fg.png", result.get("fg_path", ""))
