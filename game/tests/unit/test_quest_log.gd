extends "res://addons/gut/test.gd"

const GAME_STATE = "res://game/autoload/GameState.gd"
const DATA_REGISTRY = "res://game/autoload/DataRegistry.gd"
const QUEST_LOG = "res://game/autoload/QuestLog.gd"


func test_start_quest_sets_state() -> void:
	var game_state = load(GAME_STATE).new()
	var data_registry = load(DATA_REGISTRY).new()
	data_registry.load_all()
	var quest_log = load(QUEST_LOG).new()
	quest_log.configure(game_state, data_registry)

	assert_true(quest_log.start_quest("lantern_note"))
	assert_true(quest_log.is_active("lantern_note"))
	assert_eq(0, quest_log.get_current_step("lantern_note"))


func test_advance_quest_completes() -> void:
	var game_state = load(GAME_STATE).new()
	var data_registry = load(DATA_REGISTRY).new()
	data_registry.load_all()
	var quest_log = load(QUEST_LOG).new()
	quest_log.configure(game_state, data_registry)

	quest_log.start_quest("lantern_note")
	assert_true(quest_log.advance_quest("lantern_note", 2))
	assert_true(quest_log.is_completed("lantern_note"))
	assert_true(game_state.get_flag("quest_lantern_note_complete"))


func test_step_text_lookup() -> void:
	var game_state = load(GAME_STATE).new()
	var data_registry = load(DATA_REGISTRY).new()
	data_registry.load_all()
	var quest_log = load(QUEST_LOG).new()
	quest_log.configure(game_state, data_registry)

	quest_log.start_quest("lantern_note")
	assert_eq("Borrow a lantern.", quest_log.get_step_text("lantern_note"))
