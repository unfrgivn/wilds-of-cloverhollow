extends SceneTree

const OUTPUT_SIZE := Vector2i(256, 256)

func _init() -> void:
	var args = OS.get_cmdline_user_args()
	var recipe_path := ""
	for i in range(args.size()):
		if args[i] == "--recipe" and i + 1 < args.size():
			recipe_path = args[i + 1]
	if recipe_path.is_empty():
		print("Error: --recipe argument required")
		quit(1)
		return
	generate_sprites(recipe_path)
	quit(0)

func generate_sprites(recipe_path: String) -> void:
	var file = FileAccess.open(recipe_path, FileAccess.READ)
	if not file:
		print("Error: Could not open recipe file: " + recipe_path)
		quit(1)
		return

	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	if error != OK:
		print("Error: JSON Parse Error")
		quit(1)
		return

	var data = json.data
	var char_id = data.get("id", "unknown")
	var category = data.get("category", "enemy")
	var palette = load_palette("res://art/palettes/cloverhollow.palette.json")
	var sprite_color = resolve_sprite_color(data, palette)

	var export_dir = "res://art/exports/sprites/" + char_id
	var runtime_dir = ""
	if category == "character":
		runtime_dir = "res://game/assets/sprites/characters/" + char_id
	else:
		runtime_dir = "res://game/assets/sprites/enemies/" + char_id
	
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(export_dir))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(runtime_dir))

	var anims = ["idle", "walk"]
	var directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

	for anim in anims:
		for dir_name in directions:
			var img = make_sprite(sprite_color)
			var filename = char_id + "_" + anim + "_" + dir_name + ".png"
			img.save_png(export_dir + "/" + filename)
			img.save_png(runtime_dir + "/" + filename)
			print("Saved " + filename)

	var battle_anims = ["idle", "attack", "hurt"]
	var battle_dirs = ["L", "R"]
	for anim in battle_anims:
		for dir_name in battle_dirs:
			var battle_img = make_sprite(sprite_color)
			var battle_filename = char_id + "_battle_" + anim + "_" + dir_name + ".png"
			battle_img.save_png(export_dir + "/" + battle_filename)
			battle_img.save_png(runtime_dir + "/" + battle_filename)
			print("Saved " + battle_filename)

func resolve_sprite_color(data: Dictionary, palette: Dictionary) -> Color:
	var color_name = String(data.get("sprite_color", ""))
	if color_name.is_empty() and data.has("parts") and data["parts"].size() > 0:
		color_name = String(data["parts"][0].get("color", ""))
	if palette.has(color_name):
		return Color(palette[color_name])
	return Color(0.6, 0.8, 0.9, 1.0)

func make_sprite(color: Color) -> Image:
	var img = Image.create(OUTPUT_SIZE.x, OUTPUT_SIZE.y, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var center = Vector2(OUTPUT_SIZE.x / 2.0, OUTPUT_SIZE.y / 2.0)
	var radius = float(OUTPUT_SIZE.x) * 0.25
	for y in range(OUTPUT_SIZE.y):
		for x in range(OUTPUT_SIZE.x):
			var dx = float(x) - center.x
			var dy = float(y) - center.y
			if dx * dx + dy * dy <= radius * radius:
				img.set_pixel(x, y, color)
	return img

func load_palette(path: String) -> Dictionary:
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	var json = JSON.new()
	json.parse(file.get_as_text())
	return json.data.get("colors", {})
