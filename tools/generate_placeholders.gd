extends SceneTree

const DEFAULT_WIDTH: int = 1280
const DEFAULT_HEIGHT: int = 720

func _init() -> void:
	var width: int = _get_project_int("display/window/size/viewport_width", DEFAULT_WIDTH)
	var height: int = _get_project_int("display/window/size/viewport_height", DEFAULT_HEIGHT)
	_generate_scene(
		"town_square_01",
		Color(0.55, 0.75, 0.55, 1.0),
		[Rect2(520.0, 260.0, 160.0, 140.0)],
		[
			_occluder("fg_over.png", Rect2(420.0, 80.0, 320.0, 180.0), Color(0.20, 0.30, 0.35, 0.75))
		],
		width,
		height
	)
	_generate_scene(
		"inn_01",
		Color(0.70, 0.60, 0.45, 1.0),
		[Rect2(560.0, 300.0, 140.0, 160.0)],
		[
			_occluder("fg_over.png", Rect2(480.0, 90.0, 300.0, 170.0), Color(0.40, 0.30, 0.25, 0.75))
		],
		width,
		height
	)
	_generate_scene(
		"school_hall_01",
		Color(0.65, 0.72, 0.80, 1.0),
		[Rect2(520.0, 280.0, 180.0, 140.0)],
		[
			_occluder("fg_over.png", Rect2(420.0, 80.0, 320.0, 180.0), Color(0.25, 0.30, 0.45, 0.75))
		],
		width,
		height
	)
	_generate_scene(
		"arcade_01",
		Color(0.72, 0.60, 0.75, 1.0),
		[Rect2(560.0, 260.0, 160.0, 160.0)],
		[
			_occluder("fg_over.png", Rect2(460.0, 90.0, 300.0, 170.0), Color(0.35, 0.25, 0.45, 0.75))
		],
		width,
		height
	)
	_generate_scene(
		"fae_house_01",
		Color(0.78, 0.70, 0.60, 1.0),
		[Rect2(500.0, 300.0, 200.0, 160.0)],
		[
			_occluder("fg_over.png", Rect2(400.0, 90.0, 320.0, 180.0), Color(0.45, 0.35, 0.25, 0.75))
		],
		width,
		height
	)
	print("[Placeholders] Generated placeholder backgrounds and walkmasks.")
	quit(0)

func _get_project_int(setting: String, fallback: int) -> int:
	if ProjectSettings.has_setting(setting):
		return int(ProjectSettings.get_setting(setting))
	return fallback

func _generate_scene(scene_id: String, bg_color: Color, obstacles: Array[Rect2], occluders: Array[Dictionary], width: int, height: int) -> void:
	var folder: String = "res://content/scenes/%s" % scene_id
	_ensure_dir(folder)
	var bg_path: String = folder.path_join("bg_ground.png")
	var ground_path: String = folder.path_join("ground.png")
	var mask_path: String = folder.path_join("walkmask.png")
	_generate_background(bg_path, width, height, bg_color)
	_generate_background(ground_path, width, height, bg_color)
	_generate_walkmask(mask_path, width, height, obstacles)
	_generate_occluders(folder, occluders)

func _ensure_dir(path: String) -> void:
	var absolute: String = ProjectSettings.globalize_path(path)
	var error: Error = DirAccess.make_dir_recursive_absolute(absolute)
	if error != OK:
		push_warning("[Placeholders] Could not ensure directory: %s (%s)" % [path, error])

func _generate_background(path: String, width: int, height: int, color: Color) -> void:
	var image: Image = Image.create(width, height, false, Image.FORMAT_RGBA8)
	image.fill(color)
	var error: Error = image.save_png(path)
	if error != OK:
		push_error("[Placeholders] Failed to save %s (%s)" % [path, error])

func _generate_walkmask(path: String, width: int, height: int, obstacles: Array[Rect2]) -> void:
	var image: Image = Image.create(width, height, false, Image.FORMAT_RGBA8)
	image.fill(Color(1, 1, 1, 1))
	for rect in obstacles:
		_draw_rect(image, rect, Color(0, 0, 0, 1))
	var error: Error = image.save_png(path)
	if error != OK:
		push_error("[Placeholders] Failed to save %s (%s)" % [path, error])

func _generate_occluders(folder: String, occluders: Array[Dictionary]) -> void:
	for occluder in occluders:
		var rect: Rect2 = occluder["rect"]
		var file_name: String = occluder["file_name"]
		var color: Color = occluder["color"]
		var width: int = max(1, int(rect.size.x))
		var height: int = max(1, int(rect.size.y))
		var image: Image = Image.create(width, height, false, Image.FORMAT_RGBA8)
		image.fill(color)
		var path: String = folder.path_join(file_name)
		var error: Error = image.save_png(path)
		if error != OK:
			push_error("[Placeholders] Failed to save %s (%s)" % [path, error])

func _occluder(file_name: String, rect: Rect2, color: Color) -> Dictionary:
	return {
		"file_name": file_name,
		"rect": rect,
		"color": color
	}

func _draw_rect(image: Image, rect: Rect2, color: Color) -> void:
	var start_x: int = max(0, int(rect.position.x))
	var start_y: int = max(0, int(rect.position.y))
	var end_x: int = min(image.get_width(), int(rect.position.x + rect.size.x))
	var end_y: int = min(image.get_height(), int(rect.position.y + rect.size.y))
	for x in range(start_x, end_x):
		for y in range(start_y, end_y):
			image.set_pixel(x, y, color)
