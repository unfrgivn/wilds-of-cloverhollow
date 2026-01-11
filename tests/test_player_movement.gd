extends GutTest

var PlayerScene = load("res://scenes/player/Player.tscn")

func test_player_structure():
	var player = PlayerScene.instantiate()
	add_child_autofree(player)
	
	assert_not_null(player, "Player should instantiate")
	assert_true(player is CharacterBody2D, "Player should be CharacterBody2D")
	assert_true(player.has_node("AnimatedSprite2D"), "Player should have AnimatedSprite2D")
	assert_true(player.has_node("CollisionShape2D"), "Player should have CollisionShape2D")
	assert_true(player.has_node("Camera2D"), "Player should have Camera2D")

func test_movement_logic():
	var player = PlayerScene.instantiate()
	add_child_autofree(player)
	
	# Initial state
	assert_eq(player.velocity, Vector2.ZERO, "Velocity should start at zero")
	
	# We can't easily simulate Input.get_vector in a unit test without mocking Input
	# or using integration tests with GutInputSender if available.
	# For now, let's test the physics process logic by manually modifying the input vector logic 
	# OR by mocking the Input singleton if possible (hard in GDScript).
	
	# Alternative: Refactor Player to accept input vector as a dependency or have a function we can call.
	# But for Phase 1, basic structure and existence is the main goal.
	# Let's verify the exported variables.
	
	assert_eq(player.move_speed, 150.0)
	assert_eq(player.acceleration, 1200.0)
	assert_eq(player.friction, 1200.0)
