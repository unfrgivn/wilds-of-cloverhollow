extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const PROPS_ROOT: String = "res://content/props"
const PROP_DEF_SCRIPT: Script = preload("res://game/props/prop_def.gd")
const PipelineConstants: Script = preload("res://game/tools/pipeline_constants.gd")

const ALPHA_THRESHOLD: float = PipelineConstants.ALPHA_THRESHOLD
const SHADOW_ALPHA: float = PipelineConstants.SHADOW_ALPHA
var SHADOW_BLUR_PX: float = PipelineConstants.SHADOW_BLUR_PX
var SHADOW_OFFSET_PX: Vector2i = PipelineConstants.SHADOW_OFFSET_PX

var _had_errors: bool = false

func _init() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var include_all: bool = args.has("--all")
	var scene_json_paths: Array[String] = _find_scene_json_paths()
	var referenced_defs: Array[String] = _collect_referenced_prop_defs(scene_json_paths)
	if include_all:
		referenced_defs = _merge_unique(referenced_defs, _collect_all_prop_defs())
	referenced_defs.sort()

	print("[PropShadow] Scenes scanned: %d" % scene_json_paths.size())
	print("[PropShadow] Props checked: %d" % referenced_defs.size())
	print("[PropShadow] Mode: %s" % ("--all" if include_all else "referenced-only"))

	for prop_path in referenced_defs:
		_generate_shadow(prop_path)

	if _had_errors:
		quit(1)
	else:
		quit(0)

func _find_scene_json_paths() -> Array[String]:
	var found: Array[String] = []
	var folders: Array[String] = _list_dirs_sorted(SCENES_ROOT)
	for folder in folders:
		var json_path: String = SCENES_ROOT.path_join(folder).path_join("scene.json")
		if FileAccess.file_exists(json_path):
			found.append(json_path)
	return found

func _collect_referenced_prop_defs(scene_json_paths: Array[String]) -> Array[String]:
	var defs: Array[String] = []
	for json_path in scene_json_paths:
		var file: FileAccess = FileAccess.open(json_path, FileAccess.READ)
		if file == null:
			_push_error("Failed to read scene.json", json_path)
			continue
		var text: String = file.get_as_text()
		file.close()
		var parsed: Variant = JSON.parse_string(text)
		if typeof(parsed) != TYPE_DICTIONARY:
			_push_error("Invalid JSON", json_path)
			continue
		var props: Array = (parsed as Dictionary).get("props", [])
		for prop_entry in props:
			if typeof(prop_entry) != TYPE_DICTIONARY:
				continue
			var def_path: String = str(prop_entry.get("def", "")).strip_edges()
			if def_path != "":
				defs.append(def_path)
	return _unique_sorted(defs)

func _collect_all_prop_defs() -> Array[String]:
	var results: Array[String] = []
	_scan_prop_defs(PROPS_ROOT, results)
	return _unique_sorted(results)

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

func _generate_shadow(prop_path: String) -> void:
	var resource: Resource = ResourceLoader.load(prop_path)
	if resource == null or resource.get_script() != PROP_DEF_SCRIPT:
		_push_error("Failed to load PropDef", prop_path)
		return
	var blocks: bool = bool(resource.get("blocks_movement"))
	if not blocks:
		return
	var base_dir: String = prop_path.get_base_dir()
	var authored_path: String = base_dir.path_join("visuals/shadow.png")
	if FileAccess.file_exists(authored_path):
		return
	var generated_path: String = base_dir.path_join("_generated/shadow.png")
	if FileAccess.file_exists(generated_path):
		return
	var footprint_texture: Texture2D = resource.get("footprint_mask") as Texture2D
	if footprint_texture == null:
		_push_error("Blocking prop missing footprint_mask", prop_path)
		return
	var footprint_image: Image = _load_image(footprint_texture)
	if footprint_image == null:
		return
	footprint_image.convert(Image.FORMAT_RGBA8)
	var width: int = footprint_image.get_width()
	var height: int = footprint_image.get_height()
	var mask: Image = Image.create(width, height, false, Image.FORMAT_RGBA8)
	mask.fill(Color(0, 0, 0, 0))
	for y in range(height):
		for x in range(width):
			if footprint_image.get_pixel(x, y).a <= ALPHA_THRESHOLD:
				continue
			mask.set_pixel(x, y, Color(0, 0, 0, 1.0))
	var blurred: Image = _blur_mask(mask)
	var shadow_image: Image = Image.create(width, height, false, Image.FORMAT_RGBA8)
	shadow_image.fill(Color(0, 0, 0, 0))
	for y in range(height):
		for x in range(width):
			var alpha: float = blurred.get_pixel(x, y).a * SHADOW_ALPHA
			if alpha <= 0.0:
				continue
			var target_x: int = x + SHADOW_OFFSET_PX.x
			var target_y: int = y + SHADOW_OFFSET_PX.y
			if target_x < 0 or target_y < 0 or target_x >= width or target_y >= height:
				continue
			shadow_image.set_pixel(target_x, target_y, Color(0, 0, 0, alpha))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(generated_path.get_base_dir()))
	var save_error: Error = shadow_image.save_png(generated_path)
	if save_error != OK:
		_push_error("Failed to save shadow", generated_path)
		return
	print("[PropShadow] Wrote %s" % generated_path)

func _blur_mask(mask: Image) -> Image:
	var width: int = mask.get_width()
	var height: int = mask.get_height()
	var factor: int = max(1, int(round(SHADOW_BLUR_PX)))
	var small_w: int = max(1, int(ceil(float(width) / float(factor))))
	var small_h: int = max(1, int(ceil(float(height) / float(factor))))
	var blurred: Image = mask.duplicate()
	blurred.resize(small_w, small_h, Image.INTERPOLATE_BILINEAR)
	blurred.resize(width, height, Image.INTERPOLATE_BILINEAR)
	return blurred

func _load_image(texture: Texture2D) -> Image:
	var path: String = texture.resource_path
	if path == "":
		return null
	var absolute_path: String = ProjectSettings.globalize_path(path)
	var image: Image = Image.load_from_file(absolute_path)
	if image == null or image.is_empty():
		return null
	return image

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

func _merge_unique(a: Array[String], b: Array[String]) -> Array[String]:
	var merged: Array[String] = []
	merged.append_array(a)
	return _unique_sorted(merged)

func _push_error(message: String, detail: String) -> void:
	_had_errors = true
	push_error("[PropShadow] %s (%s)" % [message, detail])
