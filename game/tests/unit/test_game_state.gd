extends "res://addons/gut/test.gd"

var game_state_script = load("res://game/autoload/GameState.gd")

func test_add_item_increments() -> void:
	var game_state = game_state_script.new()
	game_state.flags = {}
	game_state.inventory = {}
	game_state.add_item("berry", 2)
	game_state.add_item("berry", 1)
	assert_eq(3, game_state.get_item_count("berry"))


func test_remove_item_decrements() -> void:
	var game_state = game_state_script.new()
	game_state.inventory = {"berry": 2}
	assert_true(game_state.remove_item("berry", 1))
	assert_eq(1, game_state.get_item_count("berry"))
	assert_true(game_state.remove_item("berry", 1))
	assert_eq(0, game_state.get_item_count("berry"))

func test_set_flag() -> void:
	var game_state = game_state_script.new()
	game_state.flags = {}
	game_state.set_flag("opened")
	assert_true(game_state.get_flag("opened"))


func test_party_membership() -> void:
	var game_state = game_state_script.new()
	assert_true(game_state.add_party_member("fae"))
	assert_eq(false, game_state.add_party_member("fae"))
	assert_true(game_state.has_party_member("fae"))
	assert_true(game_state.remove_party_member("fae"))
	assert_eq(false, game_state.has_party_member("fae"))


func test_roundtrip_dict() -> void:
	var game_state = game_state_script.new()
	game_state.set_flag("door_opened")
	game_state.add_item("berry", 2)
	game_state.add_party_member("fae")
	game_state.set_value("return_scene", "res://scene.tscn")
	game_state.set_quest_state("lantern_note", {"step": 1, "completed": false})

	var payload = game_state.to_dict()
	var clone = game_state_script.new()
	clone.from_dict(payload)

	assert_true(clone.get_flag("door_opened"))
	assert_eq(2, clone.get_item_count("berry"))
	assert_true(clone.has_party_member("fae"))
	assert_eq("res://scene.tscn", clone.get_value("return_scene"))
	assert_eq(1, int(clone.get_quest_state("lantern_note").get("step", -1)))
