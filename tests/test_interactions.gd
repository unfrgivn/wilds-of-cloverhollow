extends GutTest

var _game_state_backup: Dictionary = {}

func before_each() -> void:
	# Reset GameState before each test
	GameState.reset_all()

func test_container_gives_item_once() -> void:
	var container_id := "test_chest_001"
	var item_id := "candy"
	
	# Container should not be looted initially
	assert_false(GameState.is_container_looted(container_id), "Container should not be looted initially")
	assert_eq(GameState.get_item_count(item_id), 0, "Should have no candy initially")
	
	# Simulate looting
	GameState.mark_container_looted(container_id)
	GameState.add_item(item_id, 3)
	
	# Verify state changed
	assert_true(GameState.is_container_looted(container_id), "Container should be marked looted")
	assert_eq(GameState.get_item_count(item_id), 3, "Should have 3 candy after looting")

func test_container_cannot_be_looted_twice() -> void:
	var container_id := "test_chest_002"
	
	# First loot
	GameState.mark_container_looted(container_id)
	assert_true(GameState.is_container_looted(container_id))
	
	# Marking again should not change anything (idempotent)
	GameState.mark_container_looted(container_id)
	assert_true(GameState.is_container_looted(container_id))

func test_quest_flags() -> void:
	var flag := "talked_to_npc_01"
	
	# Flag should be false initially
	assert_false(GameState.get_flag(flag), "Flag should be false initially")
	
	# Set flag
	GameState.set_flag(flag, true)
	assert_true(GameState.get_flag(flag), "Flag should be true after setting")
	
	# Clear flag
	GameState.set_flag(flag, false)
	assert_false(GameState.get_flag(flag), "Flag should be false after clearing")

func test_inventory_operations() -> void:
	var item := "journal"
	
	# Initially no items
	assert_false(GameState.has_item(item), "Should not have item initially")
	assert_eq(GameState.get_item_count(item), 0)
	
	# Add item
	GameState.add_item(item, 1)
	assert_true(GameState.has_item(item), "Should have item after adding")
	assert_eq(GameState.get_item_count(item), 1)
	
	# Add more
	GameState.add_item(item, 2)
	assert_eq(GameState.get_item_count(item), 3, "Should stack items")
	
	# Remove some
	GameState.remove_item(item, 2)
	assert_eq(GameState.get_item_count(item), 1)
	assert_true(GameState.has_item(item))
	
	# Remove last
	GameState.remove_item(item, 1)
	assert_eq(GameState.get_item_count(item), 0)
	assert_false(GameState.has_item(item))

func test_dialogue_state() -> void:
	# UIRoot should start with dialogue inactive
	assert_false(UIRoot.is_dialogue_active, "Dialogue should be inactive initially")
