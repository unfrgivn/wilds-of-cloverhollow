extends GutTest

func before_each() -> void:
	GameState.reset_all()

func test_blacklight_lantern_toggle() -> void:
	# Initially no lantern
	assert_false(GameState.has_item("blacklight_lantern"))
	assert_false(GameState.get_flag("blacklight_lantern_active"))
	
	# Add lantern
	GameState.add_item("blacklight_lantern", 1)
	assert_true(GameState.has_item("blacklight_lantern"))
	
	# Toggle on
	GameState.set_flag("blacklight_lantern_active", true)
	assert_true(GameState.get_flag("blacklight_lantern_active"))
	
	# Toggle off
	GameState.set_flag("blacklight_lantern_active", false)
	assert_false(GameState.get_flag("blacklight_lantern_active"))

func test_sigil_reveal_tracking() -> void:
	var sigil_id := "sigil_school"
	var flag_name := "sigil_revealed_" + sigil_id
	
	# Initially not revealed
	assert_false(GameState.get_flag(flag_name))
	
	# Reveal sigil
	GameState.set_flag(flag_name, true)
	assert_true(GameState.get_flag(flag_name))

func test_quest_completion_flag() -> void:
	var quest_flag := "quest.hollow_light.completed"
	
	# Initially not complete
	assert_false(GameState.get_flag(quest_flag))
	
	# Complete quest
	GameState.set_flag(quest_flag, true)
	assert_true(GameState.get_flag(quest_flag))

func test_full_quest_flow_flags() -> void:
	# Simulate the full quest flow via flags
	
	# 1. Get lantern
	GameState.add_item("blacklight_lantern", 1)
	assert_true(GameState.has_item("blacklight_lantern"))
	
	# 2. Activate lantern
	GameState.set_flag("blacklight_lantern_active", true)
	
	# 3. Reveal sigils
	GameState.set_flag("sigil_revealed_sigil_school", true)
	GameState.set_flag("sigil_revealed_sigil_town", true)
	
	# 4. Verify all sigils found
	assert_true(GameState.get_flag("sigil_revealed_sigil_school"))
	assert_true(GameState.get_flag("sigil_revealed_sigil_town"))
	
	# 5. Complete quest
	GameState.set_flag("quest.hollow_light.completed", true)
	assert_true(GameState.get_flag("quest.hollow_light.completed"))
