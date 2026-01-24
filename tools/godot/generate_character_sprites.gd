extends SceneTree

const DEFAULT_RESOLUTION := 48
const DEFAULT_PIXELS_PER_METER := 24
const DEFAULT_PADDING := 2

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
	var palette_path = data.get("palette", "res://art/palettes/common.palette.json")
	var palette = load_palette(palette_path)
	var render = parse_render_settings(data)
	var fallback_color = resolve_color(String(data.get("sprite_color", "")), palette)
	var sprite_result = render_parts_to_image(data.get("parts", []), palette, render, fallback_color)
	var base_img: Image = sprite_result["image"]

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
			var img = base_img.duplicate()
			var filename = char_id + "_" + anim + "_" + dir_name + ".png"
			img.save_png(export_dir + "/" + filename)
			img.save_png(runtime_dir + "/" + filename)
			print("Saved " + filename)

	var battle_anims = ["idle", "attack", "hurt"]
	var battle_dirs = ["L", "R"]
	for anim in battle_anims:
		for dir_name in battle_dirs:
			var battle_img = base_img.duplicate()
			if dir_name == "R":
				battle_img.flip_x()
			var battle_filename = char_id + "_battle_" + anim + "_" + dir_name + ".png"
			battle_img.save_png(export_dir + "/" + battle_filename)
			battle_img.save_png(runtime_dir + "/" + battle_filename)
			print("Saved " + battle_filename)

func parse_render_settings(data: Dictionary) -> Dictionary:
	var render = data.get("render", {})
	var resolution = int(render.get("resolution", DEFAULT_RESOLUTION))
	var pixels_per_meter = int(render.get("pixels_per_meter", DEFAULT_PIXELS_PER_METER))
	var padding = int(render.get("padding", DEFAULT_PADDING))
	resolution = max(resolution, 8)
	pixels_per_meter = max(pixels_per_meter, 1)
	return {
		"resolution": resolution,
		"pixels_per_meter": pixels_per_meter,
		"padding": max(padding, 0),
	}

func render_parts_to_image(parts: Array, palette: Dictionary, render: Dictionary, fallback_color: Color) -> Dictionary:
	if parts.is_empty():
		var fallback = Image.create(render["resolution"], render["resolution"], false, Image.FORMAT_RGBA8)
		fallback.fill(Color(0, 0, 0, 0))
		var center = Vector2i(render["resolution"] / 2, render["resolution"] / 2)
		draw_circle(fallback, center, int(render["resolution"] * 0.25), fallback_color)
		return {"image": fallback}

	var bounds = compute_bounds(parts)
	var pixels_per_meter = render["pixels_per_meter"]
	var padding = render["padding"]
	var width_px = int(ceil((bounds["max_x"] - bounds["min_x"]) * pixels_per_meter)) + padding * 2
	var height_px = int(ceil((bounds["max_y"] - bounds["min_y"]) * pixels_per_meter)) + padding * 2
	var max_dim = max(width_px, height_px)
	if max_dim > render["resolution"]:
		var scale = float(render["resolution"]) / float(max_dim)
		pixels_per_meter = max(1, int(round(pixels_per_meter * scale)))
		width_px = int(ceil((bounds["max_x"] - bounds["min_x"]) * pixels_per_meter)) + padding * 2
		height_px = int(ceil((bounds["max_y"] - bounds["min_y"]) * pixels_per_meter)) + padding * 2

	var image = Image.create(width_px, height_px, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	var sorted_parts = parts.duplicate()
	sorted_parts.sort_custom(func(a, b):
		return float(a.get("pos", [0, 0, 0])[2]) < float(b.get("pos", [0, 0, 0])[2])
	)
	for part in sorted_parts:
		draw_part(image, part, palette, bounds, pixels_per_meter, padding)
	return {"image": image}

func draw_part(image: Image, part: Dictionary, palette: Dictionary, bounds: Dictionary, pixels_per_meter: int, padding: int) -> void:
	var type = String(part.get("type", "box"))
	var pos = part.get("pos", [0, 0, 0])
	var dims = part_dimensions(part)
	var center_x = int(round((pos[0] - bounds["min_x"]) * pixels_per_meter)) + padding
	var center_y = int(round((bounds["max_y"] - pos[1]) * pixels_per_meter)) + padding
	var color = resolve_color(part.get("color", ""), palette)
	if type == "sphere":
		draw_circle(image, Vector2i(center_x, center_y), int(round(dims.x * 0.5 * pixels_per_meter)), color)
	else:
		draw_rect(image, Vector2i(center_x, center_y), dims, pixels_per_meter, color)

func draw_rect(image: Image, center: Vector2i, dims: Vector2, pixels_per_meter: int, color: Color) -> void:
	var half_w = int(round(dims.x * 0.5 * pixels_per_meter))
	var half_h = int(round(dims.y * 0.5 * pixels_per_meter))
	var rect = Rect2i(center.x - half_w, center.y - half_h, max(half_w * 2, 1), max(half_h * 2, 1))
	image.fill_rect(rect, color)

func draw_circle(image: Image, center: Vector2i, radius: int, color: Color) -> void:
	var r = max(radius, 1)
	for y in range(center.y - r, center.y + r + 1):
		for x in range(center.x - r, center.x + r + 1):
			var dx = x - center.x
			var dy = y - center.y
			if dx * dx + dy * dy <= r * r:
				if x >= 0 and x < image.get_width() and y >= 0 and y < image.get_height():
					image.set_pixel(x, y, color)

func compute_bounds(parts: Array) -> Dictionary:
	var min_x = INF
	var max_x = -INF
	var min_y = INF
	var max_y = -INF
	for part in parts:
		var pos = part.get("pos", [0, 0, 0])
		var dims = part_dimensions(part)
		var half_w = dims.x * 0.5
		var half_h = dims.y * 0.5
		min_x = min(min_x, pos[0] - half_w)
		max_x = max(max_x, pos[0] + half_w)
		min_y = min(min_y, pos[1] - half_h)
		max_y = max(max_y, pos[1] + half_h)
	return {"min_x": min_x, "max_x": max_x, "min_y": min_y, "max_y": max_y}

func part_dimensions(part: Dictionary) -> Vector2:
	var type = String(part.get("type", "box"))
	var scale = part.get("scale", [1, 1, 1])
	var sx = float(scale[0])
	var sy = float(scale[1])
	if type == "box":
		var s = part.get("size", [1, 1, 1])
		return Vector2(float(s[0]) * sx, float(s[1]) * sy)
	if type == "sphere":
		var radius = float(part.get("radius", 0.5))
		return Vector2(radius * 2.0 * sx, radius * 2.0 * sy)
	if type == "cylinder":
		var height = float(part.get("height", 1.0))
		var radius = float(part.get("radius", part.get("top_radius", 0.5)))
		return Vector2(radius * 2.0 * sx, height * sy)
	return Vector2(1.0, 1.0)

func resolve_color(color_name: String, palette: Dictionary) -> Color:
	if palette.has(color_name):
		return Color(palette[color_name])
	return Color(0.6, 0.8, 0.9, 1.0)

func load_palette(path: String) -> Dictionary:
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	var json = JSON.new()
	json.parse(file.get_as_text())
	return json.data.get("colors", {})
