extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const PROP_DEF_SCRIPT: Script = preload("res://game/props/prop_def.gd")
const PipelineConstants: Script = preload("res://game/tools/pipeline_constants.gd")

const PLAYER_RADIUS_PX: int = PipelineConstants.PLAYER_RADIUS_PX
const ALPHA_THRESHOLD: float = PipelineConstants.ALPHA_THRESHOLD
const WALKABLE_THRESHOLD: float = PipelineConstants.WALKABLE_THRESHOLD

var _had_errors: bool = false

func _init() -> void:
	var scene_paths: Array[String] = _find_scene_json_paths()
	for scene_path in scene_paths:
		_bake_scene(scene_path)
	if _had_errors:
		quit(1)
	else:
		quit(0)

func _find_scene_json_paths() -> Array[String]:
	var paths: Array[String] = []
	var folders: Array[String] = _list_dirs_sorted(SCENES_ROOT)
	for folder in folders:
		var json_path: String = SCENES_ROOT.path_join(folder).path_join("scene.json")
		if FileAccess.file_exists(json_path):
			paths.append(json_path)
	return paths

func _bake_scene(scene_path: String) -> void:
	var data: Dictionary = _load_scene_json(scene_path)
	if data.is_empty():
		return
	if not data.has("assets") or typeof(data["assets"]) != TYPE_DICTIONARY:
		_push_error("Missing assets", scene_path)
		return
	var assets: Dictionary = data["assets"]
	if not assets.has("walkmask_raw") or not assets.has("walkmask_player"):
		_push_error("Missing baked asset paths", scene_path)
		return
	if not data.has("size_px") or typeof(data["size_px"]) != TYPE_ARRAY:
		_push_error("Missing size_px", scene_path)
		return
	var size_arr: Array = data["size_px"]
	if size_arr.size() != 2:
		_push_error("Invalid size_px", scene_path)
		return
	var width: int = int(size_arr[0])
	var height: int = int(size_arr[1])
	if width <= 0 or height <= 0:
		_push_error("Invalid size dimensions", scene_path)
		return

	var base_walkmask_path: String = ""
	if assets.has("base_walkmask"):
		base_walkmask_path = str(assets["base_walkmask"]).strip_edges()

	var raw_image: Image = _create_base_walkmask(width, height, base_walkmask_path, scene_path)
	if raw_image == null:
		return

	if not data.has("props") or typeof(data["props"]) != TYPE_ARRAY:
		_push_error("Missing props array", scene_path)
		return
	var props: Array = data["props"]
	for prop_entry in props:
		if typeof(prop_entry) != TYPE_DICTIONARY:
			_push_error("Invalid prop entry", scene_path)
			return
		var prop_data: Dictionary = prop_entry
		if not prop_data.has("def") or not prop_data.has("pos"):
			_push_error("Prop missing def or pos", scene_path)
			return
		var def_path: String = str(prop_data["def"]).strip_edges()
		if def_path == "":
			_push_error("Prop def empty", scene_path)
			return
		var def_resource: Resource = ResourceLoader.load(def_path)
		if def_resource == null or def_resource.get_script() != PROP_DEF_SCRIPT:
			_push_error("Failed to load PropDef: %s" % def_path, scene_path)
			return
		var blocks: bool = bool(def_resource.get("blocks_movement"))
		if not blocks:
			continue
		var footprint_texture: Texture2D = def_resource.get("footprint_mask") as Texture2D
		if footprint_texture == null:
			_push_error("Blocking prop missing footprint_mask: %s" % def_path, scene_path)
			return
		var footprint_image: Image = _load_footprint_image(def_path, footprint_texture)
		if footprint_image == null:
			return
		var anchor: Vector2i = def_resource.get("footprint_anchor_px")
		var pos_arr: Array = prop_data["pos"]
		if pos_arr.size() != 2:
			_push_error("Invalid prop pos", scene_path)
			return
		var prop_pos: Vector2i = Vector2i(int(pos_arr[0]), int(pos_arr[1]))
		_stamp_footprint(raw_image, footprint_image, prop_pos, anchor)

	var raw_path: String = str(assets["walkmask_raw"])
	DirAccess.make_dir_recursive_absolute(raw_path.get_base_dir())
	var raw_save: Error = raw_image.save_png(raw_path)
	if raw_save != OK:
		_push_error("Failed to save walkmask_raw", raw_path)
		return

	var player_image: Image = _erode_for_player(raw_image)
	var player_path: String = str(assets["walkmask_player"])
	DirAccess.make_dir_recursive_absolute(player_path.get_base_dir())
	var player_save: Error = player_image.save_png(player_path)
	if player_save != OK:
		_push_error("Failed to save walkmask_player", player_path)
		return

	print("[BakeWalkmask] %s" % scene_path)

func _create_base_walkmask(width: int, height: int, base_walkmask_path: String, scene_path: String) -> Image:
	if base_walkmask_path == "":
		var image: Image = Image.create(width, height, false, Image.FORMAT_RGBA8)
		image.fill(Color(1, 1, 1, 1))
		return image
	if not FileAccess.file_exists(base_walkmask_path):
		_push_error("base_walkmask not found: %s" % base_walkmask_path, scene_path)
		return null
	var absolute_path: String = ProjectSettings.globalize_path(base_walkmask_path)
	var base_image: Image = Image.load_from_file(absolute_path)
	if base_image == null or base_image.is_empty():
		_push_error("Failed to load base_walkmask: %s" % base_walkmask_path, scene_path)
		return null
	return base_image

func _load_scene_json(scene_path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(scene_path, FileAccess.READ)
	if file == null:
		_push_error("Failed to read scene.json", scene_path)
		return {}
	var text: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		_push_error("Invalid JSON", scene_path)
		return {}
	return parsed

func _load_footprint_image(prop_path: String, texture: Texture2D) -> Image:
	var footprint_path: String = texture.resource_path
	if footprint_path == "":
		_push_error("Footprint texture has no resource_path", prop_path)
		return null
	var absolute_path: String = ProjectSettings.globalize_path(footprint_path)
	var image: Image = Image.load_from_file(absolute_path)
	if image == null or image.is_empty():
		_push_error("Footprint load failed (load_from_file)", "%s:%s" % [prop_path, footprint_path])
		return null
	return image

func _stamp_footprint(target: Image, footprint: Image, prop_pos: Vector2i, anchor: Vector2i) -> void:
	var width: int = footprint.get_width()
	var height: int = footprint.get_height()
	for y in range(height):
		for x in range(width):
			if footprint.get_pixel(x, y).a <= ALPHA_THRESHOLD:
				continue
			var dst: Vector2i = prop_pos - anchor + Vector2i(x, y)
			if dst.x < 0 or dst.y < 0 or dst.x >= target.get_width() or dst.y >= target.get_height():
				continue
			target.set_pixel(dst.x, dst.y, Color(0, 0, 0, 1))

func _erode_for_player(raw_image: Image) -> Image:
	var size: Vector2i = raw_image.get_size()
	var bitmap: BitMap = BitMap.new()
	bitmap.create(size)
	for y in range(size.y):
		for x in range(size.x):
			var pixel: Color = raw_image.get_pixel(x, y)
			var luminance: float = (pixel.r + pixel.g + pixel.b) / 3.0
			var walkable: bool = luminance >= WALKABLE_THRESHOLD and pixel.a >= ALPHA_THRESHOLD
			bitmap.set_bitv(Vector2i(x, y), walkable)
	var rect: Rect2i = Rect2i(Vector2i.ZERO, size)
	bitmap.grow_mask(-PLAYER_RADIUS_PX, rect)
	var result: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	for y in range(size.y):
		for x in range(size.x):
			var walkable: bool = bitmap.get_bitv(Vector2i(x, y))
			result.set_pixel(x, y, Color(1, 1, 1, 1) if walkable else Color(0, 0, 0, 1))
	return result

func _list_dirs_sorted(folder: String) -> Array[String]:
	var dir: DirAccess = DirAccess.open(folder)
	if dir == null:
		return []
	var names: Array[String] = []
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		if dir.current_is_dir() and not entry.begins_with("."):
			names.append(entry)
		entry = dir.get_next()
	dir.list_dir_end()
	names.sort()
	return names

func _push_error(message: String, scene_path: String) -> void:
	_had_errors = true
	push_error("[BakeWalkmask] %s (%s)" % [message, scene_path])
