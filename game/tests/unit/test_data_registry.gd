extends "res://addons/gut/test.gd"

const REGISTRY_SCRIPT = "res://game/autoload/DataRegistry.gd"


func test_loads_enemy_defs() -> void:
	var registry = load(REGISTRY_SCRIPT).new()
	registry.load_all()
	var enemy = registry.get_enemy("slime_a")
	assert_true(enemy != null)
	assert_eq("Slime A", enemy.display_name)


func test_loads_encounter_defs() -> void:
	var registry = load(REGISTRY_SCRIPT).new()
	registry.load_all()
	var encounter = registry.get_encounter("test_encounter")
	assert_true(encounter != null)
	assert_eq(2, encounter.enemy_ids.size())
	assert_eq("slime_a", encounter.enemy_ids[0])


func test_loads_party_defs() -> void:
	var registry = load(REGISTRY_SCRIPT).new()
	registry.load_all()
	var member = registry.get_party_member("fae")
	assert_true(member != null)
	assert_eq("Fae", member.display_name)
