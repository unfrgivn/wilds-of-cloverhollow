@tool
extends SceneTree

const DEFAULT_PIXELS_PER_METER := 24
const DEFAULT_MAX_SIZE := 256
const DEFAULT_PADDING := 2

func _init():
	var args = OS.get_cmdline_user_args()
	var recipe_path = ""
	var export_root = ""
	var runtime_root = ""
	
	# Parse args manually since we are in --script mode
	for i in range(args.size()):
		if args[i] == "--recipe" and i + 1 < args.size():
			recipe_path = args[i + 1]
		elif args[i] == "--export_root" and i + 1 < args.size():
			export_root = args[i + 1]
		elif args[i] == "--runtime_root" and i + 1 < args.size():
			runtime_root = args[i + 1]
			
	if recipe_path == "":
		print("Error: --recipe argument required")
		quit(1)
		return

	generate_prop(recipe_path, export_root, runtime_root)
	quit(0)

func generate_prop(recipe_path, export_root: String, runtime_root: String):
	var file = FileAccess.open(recipe_path, FileAccess.READ)
	if not file:
		print("Error: Could not open recipe file: " + recipe_path)
		quit(1)
		return
		
	var json = JSON.new()
	var error = json.parse(file.get_as_text())
	if error != OK:
		print("Error: JSON Parse Error: ", json.get_error_message(), " in ", recipe_path, " at line ", json.get_error_line())
		quit(1)
		return
		
	var data = json.data
	var prop_id = data.get("id", "unknown")
	var palette_path = resolve_palette_path(recipe_path, data)
	var palette = load_palette(palette_path)
	var render = parse_render_settings(data)
	var render_result = render_parts_to_image(data.get("parts", []), palette, render)
	var image: Image = render_result["image"]
	var pixels_per_meter: int = render_result["pixels_per_meter"]

	# Ensure output directories exist
	var resolved_export_root = export_root if export_root != "" else "res://art/exports/models/props"
	var resolved_runtime_root = runtime_root if runtime_root != "" else "res://game/assets/props"
	var export_dir = resolved_export_root + "/" + prop_id
	var runtime_dir = resolved_runtime_root
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(export_dir))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(runtime_dir))

	var png_name = prop_id + ".png"
	var export_png = export_dir + "/" + png_name
	var runtime_png = runtime_dir + "/" + png_name
	image.save_png(export_png)
	image.save_png(runtime_png)
	print("Saved texture: " + export_png)

	var root = Node3D.new()
	root.name = prop_id
	var sprite = Sprite3D.new()
	sprite.name = prop_id + "_Sprite"
	sprite.texture = ImageTexture.create_from_image(image)
	sprite.pixel_size = 1.0 / float(pixels_per_meter)
	sprite.centered = true
	root.add_child(sprite)
	sprite.owner = root
		
	var scene = PackedScene.new()
	var result = scene.pack(root)
	if result == OK:
		var export_path = export_dir + "/" + prop_id + ".tscn"
		var runtime_path = runtime_dir + "/" + prop_id + ".tscn"
		
		ResourceSaver.save(scene, export_path)
		print("Saved export: " + export_path)
		
		ResourceSaver.save(scene, runtime_path)
		print("Saved runtime: " + runtime_path)
	else:
		print("Error: Failed to pack scene")
		quit(1)

func parse_render_settings(data: Dictionary) -> Dictionary:
	var render = data.get("render", {})
	var pixels_per_meter = int(render.get("pixels_per_meter", DEFAULT_PIXELS_PER_METER))
	var padding = int(render.get("padding", DEFAULT_PADDING))
	var max_size = int(render.get("max_size", render.get("resolution", DEFAULT_MAX_SIZE)))
	pixels_per_meter = max(pixels_per_meter, 1)
	return {
		"pixels_per_meter": pixels_per_meter,
		"padding": max(padding, 0),
		"max_size": max(max_size, 1),
	}

func render_parts_to_image(parts: Array, palette: Dictionary, render: Dictionary) -> Dictionary:
	if parts.is_empty():
		var empty = Image.create(1, 1, false, Image.FORMAT_RGBA8)
		empty.fill(Color(0, 0, 0, 0))
		return {"image": empty, "pixels_per_meter": render["pixels_per_meter"]}

	var bounds = compute_bounds(parts)
	var pixels_per_meter = render["pixels_per_meter"]
	var padding = render["padding"]
	var max_size = render["max_size"]
	var width_px = int(ceil((bounds["max_x"] - bounds["min_x"]) * pixels_per_meter)) + padding * 2
	var height_px = int(ceil((bounds["max_y"] - bounds["min_y"]) * pixels_per_meter)) + padding * 2
	var max_dim = max(width_px, height_px)
	if max_dim > max_size:
		var scale = float(max_size) / float(max_dim)
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
	return {"image": image, "pixels_per_meter": pixels_per_meter}

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
	return Color(1.0, 0.0, 1.0, 1.0)

func load_palette(path):
	var file = FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	var json = JSON.new()
	json.parse(file.get_as_text())
	var data = json.data
	return data.get("colors", {})

func resolve_palette_path(recipe_path: String, data: Dictionary) -> String:
	if data.has("palette"):
		return String(data["palette"])
	var normalized = recipe_path.replace("\\", "/")
	var tokens = normalized.split("/")
	var idx = tokens.find("recipes")
	if idx != -1 and idx + 2 < tokens.size():
		var biome = tokens[idx + 2]
		var candidate = "res://art/palettes/" + biome + ".palette.json"
		if FileAccess.file_exists(candidate):
			return candidate
	return "res://art/palettes/cloverhollow.palette.json"
