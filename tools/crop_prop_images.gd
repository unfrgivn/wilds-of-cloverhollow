extends SceneTree

const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")
const SCENES_ROOT: String = "res://content/scenes"
const PROPS_ROOT: String = "res://content/props"
const FLAG_ALL: String = "--all"
const CROP_ALPHA_THRESHOLD: float = 0.05

var _had_errors: bool = false

func _init() -> void:
	_run()

func _run() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var check_all: bool = args.has(FLAG_ALL)
	var prop_paths: Array[String] = []
	var scene_paths: Array[String] = []
	if check_all:
		prop_paths = _find_prop_defs_all()
	else:
		scene_paths = _find_scene_json_paths()
		prop_paths = _collect_referenced_prop_defs(scene_paths)
	prop_paths.sort()
	if not check_all:
		print("[CropProps] Scenes scanned: %d" % scene_paths.size())
	print("[CropProps] Props checked: %d" % prop_paths.size())
	for prop_path in prop_paths:
		_process_prop(prop_path)
	if _had_errors:
		quit(1)
	else:
		quit(0)

func _process_prop(prop_path: String) -> void:
	var prop_def: PropDef = _load_prop_def(prop_path)
	if prop_def == null:
		return
	var texture_paths: Array[String] = _collect_prop_texture_paths(prop_def)
	if texture_paths.is_empty():
		_push_error("No textures found for prop", prop_path)
		return
	for path in texture_paths:
		_crop_texture(path, prop_path)

func _collect_prop_texture_paths(prop_def: PropDef) -> Array[String]:
	var paths: Array[String] = []
	for texture in prop_def.base_textures:
		_add_texture_path(texture, paths)
	for texture in prop_def.overhang_textures:
		_add_texture_path(texture, paths)
	if paths.is_empty():
		var fallback: Array[String] = _collect_prefab_texture_paths(prop_def)
		paths.append_array(fallback)
	paths = _unique_sorted(paths)
	return paths

func _add_texture_path(texture: Texture2D, paths: Array[String]) -> void:
	if texture == null:
		return
	var path: String = texture.resource_path
	if path == "":
		return
	paths.append(path)

func _collect_prefab_texture_paths(prop_def: PropDef) -> Array[String]:
	var results: Array[String] = []
	if prop_def.prefab == null:
		return results
	var instance: Node = prop_def.prefab.instantiate()
	if instance == null:
		return results
	var base_sprite: Sprite2D = instance.get_node_or_null("BaseSprite") as Sprite2D
	if base_sprite != null:
		_add_texture_path(base_sprite.texture, results)
	var overhang_sprite: Sprite2D = instance.get_node_or_null("OverhangSprite") as Sprite2D
	if overhang_sprite != null:
		_add_texture_path(overhang_sprite.texture, results)
	instance.free()
	return results

func _crop_texture(path: String, prop_path: String) -> void:
	if not FileAccess.file_exists(path):
		_push_error("Missing texture: %s" % path, prop_path)
		return
	var image: Image = null
	var texture: Texture2D = ResourceLoader.load(path) as Texture2D
	if texture != null:
		image = texture.get_image()
	if image == null or image.is_empty():
		image = Image.load_from_file(path)
	if image == null or image.is_empty():
		_push_error("Failed to load texture: %s" % path, prop_path)
		return
	if not _has_alpha_channel(image):
		_push_error("Texture missing alpha channel: %s" % path, prop_path)
		return
	image.convert(Image.FORMAT_RGBA8)
	var bounds: Rect2i = _find_alpha_bounds(image)
	if bounds.size.x <= 0 or bounds.size.y <= 0:
		_push_error("Texture has no visible alpha: %s" % path, prop_path)
		return
	var padded: Rect2i = _expand_bounds(bounds, image.get_size(), PIPELINE_CONSTANTS.ART_PADDING_PX)
	if _bounds_match_image(padded, image.get_size()):
		return
	var cropped: Image = Image.create(padded.size.x, padded.size.y, false, Image.FORMAT_RGBA8)
	cropped.fill(Color(0, 0, 0, 0))
	cropped.blit_rect(image, padded, Vector2i.ZERO)
	var save_error: Error = cropped.save_png(path)
	if save_error != OK:
		_push_error("Failed to save cropped texture: %s" % path, prop_path)
		return
	print("[CropProps] Wrote %s" % path)

func _has_alpha_channel(image: Image) -> bool:
	var format: Image.Format = image.get_format()
	return format == Image.FORMAT_RGBA8 or format == Image.FORMAT_RGBA4444 or format == Image.FORMAT_RGBAF

func _find_alpha_bounds(image: Image) -> Rect2i:
	var width: int = image.get_width()
	var height: int = image.get_height()
	var min_x: int = width
	var min_y: int = height
	var max_x: int = -1
	var max_y: int = -1
	for y in range(height):
		for x in range(width):
			if image.get_pixel(x, y).a <= CROP_ALPHA_THRESHOLD:
				continue
			if x < min_x:
				min_x = x
			if y < min_y:
				min_y = y
			if x > max_x:
				max_x = x
			if y > max_y:
				max_y = y
	if max_x < min_x or max_y < min_y:
		return Rect2i()
	return Rect2i(Vector2i(min_x, min_y), Vector2i(max_x - min_x + 1, max_y - min_y + 1))

func _expand_bounds(bounds: Rect2i, image_size: Vector2i, padding: int) -> Rect2i:
	var min_x: int = max(0, bounds.position.x - padding)
	var min_y: int = max(0, bounds.position.y - padding)
	var max_x: int = min(image_size.x - 1, bounds.position.x + bounds.size.x - 1 + padding)
	var max_y: int = min(image_size.y - 1, bounds.position.y + bounds.size.y - 1 + padding)
	return Rect2i(Vector2i(min_x, min_y), Vector2i(max_x - min_x + 1, max_y - min_y + 1))

func _bounds_match_image(bounds: Rect2i, image_size: Vector2i) -> bool:
	return bounds.position == Vector2i.ZERO and bounds.size == image_size

func _load_prop_def(prop_path: String) -> PropDef:
	var resource: Resource = ResourceLoader.load(prop_path)
	if resource == null:
		_push_error("Failed to load PropDef", prop_path)
		return null
	if not (resource is PropDef):
		_push_error("Resource is not PropDef", prop_path)
		return null
	return resource

func _find_scene_json_paths() -> Array[String]:
	var paths: Array[String] = []
	var folders: Array[String] = _list_dirs_sorted(SCENES_ROOT)
	for folder in folders:
		var json_path: String = SCENES_ROOT.path_join(folder).path_join("scene.json")
		if FileAccess.file_exists(json_path):
			paths.append(json_path)
	return paths

func _collect_referenced_prop_defs(scene_json_paths: Array[String]) -> Array[String]:
	var def_paths: Array[String] = []
	var seen: Dictionary = {}
	for json_path in scene_json_paths:
		var data: Dictionary = _load_scene_json(json_path)
		if data.is_empty():
			continue
		var props: Array = data.get("props", [])
		for entry in props:
			if typeof(entry) != TYPE_DICTIONARY:
				continue
			var def_path: String = entry.get("def", "")
			if def_path == "" or seen.has(def_path):
				continue
			seen[def_path] = true
			def_paths.append(def_path)
	return def_paths

func _find_prop_defs_all() -> Array[String]:
	var results: Array[String] = []
	_scan_prop_defs(PROPS_ROOT, results)
	results.sort()
	return results

func _scan_prop_defs(folder: String, results: Array[String]) -> void:
	var dir: DirAccess = DirAccess.open(folder)
	if dir == null:
		return
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		if dir.current_is_dir() and not entry.begins_with("."):
			_scan_prop_defs(folder.path_join(entry), results)
		elif entry.ends_with("_def.tres"):
			results.append(folder.path_join(entry))
		entry = dir.get_next()
	dir.list_dir_end()

func _load_scene_json(scene_path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(scene_path, FileAccess.READ)
	if file == null:
		_push_error("Failed to open scene.json", scene_path)
		return {}
	var content: String = file.get_as_text()
	file.close()
	var result: Variant = JSON.parse_string(content)
	if typeof(result) != TYPE_DICTIONARY:
		_push_error("scene.json parse error", scene_path)
		return {}
	return result as Dictionary

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

func _unique_sorted(items: Array[String]) -> Array[String]:
	var seen: Dictionary = {}
	var unique: Array[String] = []
	for item in items:
		if not seen.has(item):
			seen[item] = true
			unique.append(item)
	unique.sort()
	return unique

func _push_error(message: String, prop_path: String) -> void:
	_had_errors = true
	push_error("[CropProps] %s (%s)" % [message, prop_path])
