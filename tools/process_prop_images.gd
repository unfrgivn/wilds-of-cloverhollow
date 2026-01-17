extends SceneTree

const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")
const SCENES_ROOT: String = "res://content/scenes"
const PROPS_ROOT: String = "res://content/props"
const MANIFEST_SUFFIX: String = "_manifest.json"
const FLAG_ALL: String = "--all"
const CROP_ALPHA_THRESHOLD: float = 0.05

var _had_errors: bool = false

func _init() -> void:
	_run()

func _run() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var check_all: bool = args.has(FLAG_ALL)
	var prop_sources: Array[Dictionary] = _collect_prop_sources(check_all)
	prop_sources.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return str(a.get("id", "")) < str(b.get("id", "")))
	print("[ProcessProps] Props checked: %d" % prop_sources.size())
	for source in prop_sources:
		_process_prop(source)
	quit(1 if _had_errors else 0)

func _collect_prop_sources(include_all: bool) -> Array[Dictionary]:
	var sources: Array[Dictionary] = []
	if include_all:
		var manifest_paths: Array[String] = _find_manifest_paths(PROPS_ROOT)
		for path in manifest_paths:
			var source: Dictionary = _source_from_manifest(path)
			if not source.is_empty():
				sources.append(source)
		var def_paths: Array[String] = _find_prop_defs_all()
		for def_path in def_paths:
			var manifest_path: String = _manifest_path_for_def(def_path)
			if FileAccess.file_exists(manifest_path):
				continue
			var fallback: Dictionary = _source_from_prop_def(def_path)
			if not fallback.is_empty():
				sources.append(fallback)
	else:
		var scene_paths: Array[String] = _find_scene_json_paths()
		var def_paths: Array[String] = _collect_referenced_prop_defs(scene_paths)
		for def_path in def_paths:
			var manifest_path: String = _manifest_path_for_def(def_path)
			if FileAccess.file_exists(manifest_path):
				var source_from_manifest: Dictionary = _source_from_manifest(manifest_path)
				if not source_from_manifest.is_empty():
					sources.append(source_from_manifest)
			else:
				var fallback_source: Dictionary = _source_from_prop_def(def_path)
				if not fallback_source.is_empty():
					sources.append(fallback_source)
	return _unique_sources(sources)

func _process_prop(source: Dictionary) -> void:
	var texture_paths: Array[String] = source.get("textures", [])
	for path in texture_paths:
		_process_texture(path, source.get("id", ""))

func _process_texture(path: String, prop_id: String) -> void:
	if not FileAccess.file_exists(path):
		_push_error("Missing texture: %s" % path, prop_id)
		return
	var image: Image = _load_image_for_processing(path)
	if image == null or image.is_empty():
		_push_error("Failed to load texture: %s" % path, prop_id)
		return
	if not _has_alpha_channel(image):
		_push_error("Texture missing alpha channel: %s" % path, prop_id)
		return
	image.convert(Image.FORMAT_RGBA8)
	var bounds: Rect2i = _find_alpha_bounds(image)
	if bounds.size.x <= 0 or bounds.size.y <= 0:
		_push_error("Texture has no visible alpha: %s" % path, prop_id)
		return
	var padded: Rect2i = _expand_bounds(bounds, image.get_size(), PIPELINE_CONSTANTS.ART_PADDING_PX)
	var cropped: Image = Image.create(padded.size.x, padded.size.y, false, Image.FORMAT_RGBA8)
	cropped.fill(Color(0, 0, 0, 0))
	cropped.blit_rect(image, padded, Vector2i.ZERO)
	var output_path: String = _processed_path(path)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_path.get_base_dir()))
	if cropped.save_png(output_path) != OK:
		_push_error("Failed to save processed texture: %s" % output_path, prop_id)
		return
	print("[ProcessProps] Wrote %s" % output_path)

func _load_image_for_processing(path: String) -> Image:
	if ResourceLoader.exists(path, "Texture2D"):
		var texture: Texture2D = ResourceLoader.load(path) as Texture2D
		if texture != null:
			var image: Image = texture.get_image()
			if image != null and not image.is_empty():
				return image
	return Image.load_from_file(path)

func _processed_path(path: String) -> String:
	var base_dir: String = path.get_base_dir()
	return base_dir.path_join("_processed").path_join(path.get_file())

func _source_from_manifest(manifest_path: String) -> Dictionary:
	var data: Dictionary = _load_manifest(manifest_path)
	if data.is_empty():
		return {}
	var asset_id: String = str(data.get("asset_id", "")).strip_edges()
	if asset_id == "":
		return {}
	var outputs: Dictionary = data.get("outputs", {})
	var base_rel: String = str(outputs.get("base_png", "")).strip_edges()
	if base_rel == "":
		return {}
	var overhang_rel: String = ""
	if outputs.has("overhang_png") and outputs["overhang_png"] != null:
		overhang_rel = str(outputs.get("overhang_png", "")).strip_edges()
	var base_dir: String = manifest_path.get_base_dir()
	var textures: Array[String] = []
	textures.append(base_dir.path_join(base_rel))
	if overhang_rel != "":
		textures.append(base_dir.path_join(overhang_rel))
	return {"id": asset_id, "textures": _unique_sorted(textures)}

func _source_from_prop_def(def_path: String) -> Dictionary:
	var prop_def: PropDef = _load_prop_def(def_path)
	if prop_def == null:
		return {}
	var textures: Array[String] = []
	for texture in prop_def.base_textures:
		_add_texture_path(texture, textures)
	for texture in prop_def.overhang_textures:
		_add_texture_path(texture, textures)
	if textures.is_empty():
		var fallback: Array[String] = _collect_prefab_texture_paths(prop_def)
		textures.append_array(fallback)
	textures = _unique_sorted(textures)
	return {"id": prop_def.id, "textures": textures}

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

func _find_manifest_paths(folder: String) -> Array[String]:
	var results: Array[String] = []
	_scan_manifest_paths(folder, results)
	return results

func _scan_manifest_paths(folder: String, results: Array[String]) -> void:
	var dir: DirAccess = DirAccess.open(folder)
	if dir == null:
		return
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		var path: String = folder.path_join(entry)
		if dir.current_is_dir() and not entry.begins_with("."):
			_scan_manifest_paths(path, results)
		elif entry.ends_with(MANIFEST_SUFFIX):
			results.append(path)
		entry = dir.get_next()
	dir.list_dir_end()

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

func _manifest_path_for_def(def_path: String) -> String:
	var base_dir: String = def_path.get_base_dir()
	var asset_id: String = base_dir.get_file()
	return base_dir.path_join("%s_manifest.json" % asset_id)

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

func _load_prop_def(prop_path: String) -> PropDef:
	var resource: Resource = ResourceLoader.load(prop_path)
	if resource == null:
		_push_error("Failed to load PropDef", prop_path)
		return null
	if not (resource is PropDef):
		_push_error("Resource is not PropDef", prop_path)
		return null
	return resource

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
	return result

func _load_manifest(path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		_push_error("Failed to read manifest", path)
		return {}
	var text: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		_push_error("Manifest JSON invalid", path)
		return {}
	return parsed

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

func _unique_sources(sources: Array[Dictionary]) -> Array[Dictionary]:
	var by_id: Dictionary = {}
	for source in sources:
		var key: String = str(source.get("id", ""))
		if key == "":
			continue
		by_id[key] = source
	var keys: Array = by_id.keys()
	keys.sort()
	var ordered: Array[Dictionary] = []
	for key in keys:
		ordered.append(by_id[key])
	return ordered

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

func _push_error(message: String, prop_id: String) -> void:
	_had_errors = true
	push_error("[ProcessProps] %s (%s)" % [message, prop_id])
