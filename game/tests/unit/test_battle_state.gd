extends "res://addons/gut/test.gd"

const STATE_SCRIPT = "res://game/scripts/battle/battle_state.gd"
const ACTOR_SCRIPT = "res://game/scripts/battle/battle_actor.gd"


func _make_actor(id: String, hp: int, is_enemy: bool):
	var actor = load(ACTOR_SCRIPT).new(id, id.capitalize(), hp, 0, is_enemy)
	return actor


func test_attack_advances_turn() -> void:
	var state = load(STATE_SCRIPT).new()
	var party = [_make_actor("fae", 10, false)]
	var enemies = [_make_actor("slime", 6, true)]
	state.setup(party, enemies)

	var accepted = state.select_command("attack")

	assert_true(accepted)
	assert_eq("awaiting_command", state.phase)
	assert_true(enemies[0].hp < enemies[0].max_hp)
	assert_eq(1, state.turn_count)
	assert_eq(2, state.last_actions.size())
	assert_eq(false, state.last_actions[0]["attacker_is_enemy"])
	assert_eq(true, state.last_actions[0]["target_is_enemy"])


func test_run_ends_battle() -> void:
	var state = load(STATE_SCRIPT).new()
	var party = [_make_actor("fae", 10, false)]
	var enemies = [_make_actor("slime", 6, true)]
	state.setup(party, enemies)

	state.select_command("run")

	assert_eq("fled", state.result)
	assert_eq("battle_over", state.phase)


func test_victory_after_two_attacks() -> void:
	var state = load(STATE_SCRIPT).new()
	var party = [_make_actor("fae", 12, false)]
	var enemies = [_make_actor("slime", 5, true)]
	state.setup(party, enemies)

	state.select_command("attack")
	state.select_command("attack")

	assert_eq("victory", state.result)
