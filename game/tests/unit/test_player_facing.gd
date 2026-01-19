extends "res://addons/gut/test.gd"

const PLAYER_SCRIPT = "res://game/scripts/exploration/player.gd"


func test_facing_east() -> void:
	var player = load(PLAYER_SCRIPT).new()
	player._update_facing(Vector2(1, 0))
	assert_eq("E", player.get_facing_name())
	player.free()


func test_facing_north() -> void:
	var player = load(PLAYER_SCRIPT).new()
	player._update_facing(Vector2(0, -1))
	assert_eq("N", player.get_facing_name())
	player.free()


func test_facing_southwest() -> void:
	var player = load(PLAYER_SCRIPT).new()
	player._update_facing(Vector2(-1, 1))
	assert_eq("SW", player.get_facing_name())
	player.free()
