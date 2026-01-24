extends SceneTree

const OUTPUT_SIZE := Vector2i(960, 540)

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
	generate_background(recipe_path)
	quit(0)

func generate_background(recipe_path: String) -> void:
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
	var bg_id = data.get("id", "unknown")
	var biome = data.get("biome", "cloverhollow")
	var palette = load_palette("res://art/palettes/" + biome + ".palette.json")
	
	var runtime_dir = "res://game/assets/battle_backgrounds/" + biome + "/" + bg_id
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(runtime_dir))

	var img = make_background(data, palette)
	var filename = "bg.png"
	img.save_png(runtime_dir + "/" + filename)
	print("Saved " + filename)

func make_background(data: Dictionary, palette: Dictionary) -> Image:
	var img = Image.create(OUTPUT_SIZE.x, OUTPUT_SIZE.y, false, Image.FORMAT_RGBA8)
	var colors = data.get("colors", {})
	var sky_color = resolve_color(colors.get("sky", ""), palette, Color(0.4, 0.6, 0.9))
	var ground_color = resolve_color(colors.get("ground", ""), palette, Color(0.3, 0.8, 0.3))
	var path_color = resolve_color(colors.get("path", ""), palette, ground_color.darkened(0.2))

	img.fill(sky_color)
	var horizon_y = int(OUTPUT_SIZE.y * 0.6)
	img.fill_rect(Rect2i(0, horizon_y, OUTPUT_SIZE.x, OUTPUT_SIZE.y - horizon_y), ground_color)

	var path_height = OUTPUT_SIZE.y - horizon_y
	for y in range(horizon_y, OUTPUT_SIZE.y):
		var t = float(y - horizon_y) / float(max(path_height - 1, 1))
		var half_width = int(OUTPUT_SIZE.x * (0.05 + 0.35 * t))
		var center_x = int(OUTPUT_SIZE.x * 0.5)
		var left = max(center_x - half_width, 0)
		var right = min(center_x + half_width, OUTPUT_SIZE.x - 1)
		for x in range(left, right):
			img.set_pixel(x, y, path_color)
	
	return img

func resolve_color(color_name: String, palette: Dictionary, default: Color) -> Color:
	if palette.has(color_name):
		return Color(palette[color_name])
	return default

func load_palette(path: String) -> Dictionary:
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	var json = JSON.new()
	json.parse(file.get_as_text())
	return json.data.get("colors", {})
