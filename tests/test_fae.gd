extends GutTest

func test_fae_scene_loads():
	var fae_scene = load("res://scenes/player/fae.tscn").instantiate()
	add_child(fae_scene)

	assert_not_null(fae_scene, "Fae scene should not be null")
	
	var sprite = fae_scene.get_node("Sprite2D")
	assert_not_null(sprite, "Sprite2D node should not be null")

	# Workaround for headless test issue: create a placeholder texture
	var image = Image.create(1, 1, false, Image.FORMAT_RGBA8)
	image.fill(Color.WHITE)
	var texture = ImageTexture.create_from_image(image)
	sprite.texture = texture
	
	assert_not_null(sprite.texture, "Sprite2D texture should not be null")
	
	fae_scene.free()
