extends SceneTree

const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")
const SCENES_ROOT: String = "res://content/scenes"
const PROPS_ROOT: String = "res://content/props"
const FLAG_ALL: String = "--all"
const MAX_BORDER_ALPHA_RATIO: float = 0.1
const MIN_PROP_TEX_PX: int = 32

var _had_errors: bool = false
var _had_warnings: bool = false
var _current_prop_errors: bool = false
var _current_prop_warnings: bool = false

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
		print("[ArtQA] Scenes scanned: %d" % scene_paths.size())
	print("[ArtQA] Props checked: %d" % prop_paths.size())
	for prop_path in prop_paths:
		_qa_prop(prop_path)
	if _had_errors:
		quit(1)
	else:
		quit(0)

func _qa_prop(prop_path: String) -> void:
	_current_prop_errors = false
	_current_prop_warnings = false
	var prop_def: PropDef = _load_prop_def(prop_path)
	var prop_id: String = _prop_display_id(prop_def, prop_path)
	if prop_def == null:
		_finalize_prop_status(prop_id, prop_path)
		return
	var prefab: PackedScene = prop_def.prefab
	if prefab == null:
		_push_error("Missing prefab", prop_path)
		_finalize_prop_status(prop_id, prop_path)
		return
	var instance: Node = prefab.instantiate()
	if instance == null:
		_push_error("Failed to instantiate prefab", prop_path)
		_finalize_prop_status(prop_id, prop_path)
		return
	get_root().add_child(instance)
	var base_sprite: Sprite2D = instance.get_node_or_null("BaseSprite") as Sprite2D
	if base_sprite == null:
		_push_error("Missing BaseSprite node", prop_path)
		instance.free()
		_finalize_prop_status(prop_id, prop_path)
		return
	var base_texture: Texture2D = _resolve_base_texture(base_sprite, prop_def)
	if base_texture == null:
		_push_error("Missing BaseSprite texture", prop_path)
		instance.free()
		_finalize_prop_status(prop_id, prop_path)
		return
	var base_image: Image = _load_texture_image(base_texture, prop_path, "BaseSprite")
	if base_image == null:
		instance.free()
		_finalize_prop_status(prop_id, prop_path)
		return
	_validate_texture_size(base_image, prop_path, "BaseSprite")
	_validate_alpha_channel(base_image, prop_path, "BaseSprite")
	_validate_transparency(base_image, prop_path, "BaseSprite")
	_validate_checkerboard(base_image, prop_path, "BaseSprite")
	_validate_padding(base_image, prop_path, "BaseSprite")

	var overhang_sprite: Sprite2D = instance.get_node_or_null("OverhangSprite") as Sprite2D
	if overhang_sprite == null and prop_def.has_overhang:
		_push_warning("PropDef expects overhang but node missing", prop_path)
	elif overhang_sprite != null:
		if overhang_sprite.texture == null:
			_push_error("OverhangSprite missing texture", prop_path)
		else:
			var overhang_image: Image = _load_texture_image(overhang_sprite.texture, prop_path, "OverhangSprite")
			if overhang_image != null:
				_validate_texture_size(overhang_image, prop_path, "OverhangSprite")
				_validate_alpha_channel(overhang_image, prop_path, "OverhangSprite")
				_validate_transparency(overhang_image, prop_path, "OverhangSprite")
				_validate_checkerboard(overhang_image, prop_path, "OverhangSprite")
				_validate_padding(overhang_image, prop_path, "OverhangSprite")

	var shadow_sprite: Sprite2D = instance.get_node_or_null("ShadowSprite") as Sprite2D
	if shadow_sprite == null:
		_push_error("Missing ShadowSprite node", prop_path)
	else:
		_validate_shadow_assets(prop_def, prop_path)

	instance.free()
	_finalize_prop_status(prop_id, prop_path)

func _resolve_base_texture(sprite: Sprite2D, prop_def: PropDef) -> Texture2D:
	if sprite.texture != null:
		return sprite.texture
	if prop_def.base_textures.size() > 0:
		return prop_def.base_textures[0]
	return null

func _validate_shadow_assets(prop_def: PropDef, prop_path: String) -> void:
	if prop_def.resource_path == "":
		_push_error("PropDef resource_path missing", prop_path)
		return
	var base_dir: String = prop_def.resource_path.get_base_dir()
	var authored_path: String = base_dir.path_join("visuals/shadow.png")
	var generated_path: String = base_dir.path_join("_generated/shadow.png")
	var has_authored: bool = FileAccess.file_exists(authored_path)
	var has_generated: bool = FileAccess.file_exists(generated_path)
	if not has_authored and not has_generated:
		if prop_def.blocks_movement:
			_push_error("Blocking prop missing shadow (authored or generated)", prop_path)
		else:
			_push_warning("Missing shadow (authored or generated)", prop_path)
		return
	if has_authored:
		_validate_shadow_image(authored_path, prop_path, "AuthoredShadow")
	elif has_generated:
		_validate_shadow_image(generated_path, prop_path, "GeneratedShadow")

func _validate_shadow_image(path: String, prop_path: String, label: String) -> void:
	if not FileAccess.file_exists(path):
		_push_error("%s path missing" % label, prop_path)
		return
	var image: Image = Image.load_from_file(path)
	if image == null or image.is_empty():
		_push_error("%s failed to load" % label, prop_path)
		return
	var size: Vector2i = image.get_size()
	if size.x <= 0 or size.y <= 0:
		_push_error("%s has invalid size" % label, prop_path)
		return

func _validate_texture_size(image: Image, prop_path: String, label: String) -> void:
	var size: Vector2i = image.get_size()
	if size.x <= 0 or size.y <= 0:
		_push_error("%s texture has invalid size" % label, prop_path)
		return
	if size.x > PIPELINE_CONSTANTS.MAX_PROP_TEX_PX or size.y > PIPELINE_CONSTANTS.MAX_PROP_TEX_PX:
		_push_warning("%s texture exceeds max size" % label, prop_path)
	if size.x < MIN_PROP_TEX_PX or size.y < MIN_PROP_TEX_PX:
		_push_warning("%s texture is very small" % label, prop_path)

func _validate_padding(image: Image, prop_path: String, label: String) -> void:
	var padding: int = PIPELINE_CONSTANTS.ART_PADDING_PX
	var size: Vector2i = image.get_size()
	if size.x <= padding * 2 or size.y <= padding * 2:
		_push_error("%s texture too small for padding check" % label, prop_path)
		return
	var alpha_ratio: float = _border_alpha_ratio(image, padding, PIPELINE_CONSTANTS.ALPHA_THRESHOLD)
	if alpha_ratio > MAX_BORDER_ALPHA_RATIO:
		_push_error("%s texture lacks transparent padding" % label, prop_path)

func _validate_alpha_channel(image: Image, prop_path: String, label: String) -> void:
	if not _has_alpha_channel(image):
		_push_error("%s texture missing alpha channel" % label, prop_path)

func _validate_transparency(image: Image, prop_path: String, label: String) -> void:
	var width: int = image.get_width()
	var height: int = image.get_height()
	var transparent_count: int = 0
	for y in range(height):
		for x in range(width):
			if image.get_pixel(x, y).a < 0.99:
				transparent_count += 1
	if transparent_count == 0:
		_push_error("%s texture has no transparent pixels" % label, prop_path)

func _validate_checkerboard(image: Image, prop_path: String, label: String) -> void:
	var opaque_ratio: float = _opaque_ratio(image, 0.95)
	if opaque_ratio < 0.9:
		return
	var dominant_ratio: float = _dominant_color_ratio(image)
	if dominant_ratio > 0.6:
		_push_error("%s texture appears to have opaque background" % label, prop_path)

func _has_alpha_channel(image: Image) -> bool:
	var format: Image.Format = image.get_format()
	return format == Image.FORMAT_RGBA8 or format == Image.FORMAT_RGBA4444 or format == Image.FORMAT_RGBAF

func _opaque_ratio(image: Image, alpha_threshold: float) -> float:
	var width: int = image.get_width()
	var height: int = image.get_height()
	var total: int = width * height
	if total == 0:
		return 0.0
	var opaque: int = 0
	for y in range(height):
		for x in range(width):
			if image.get_pixel(x, y).a >= alpha_threshold:
				opaque += 1
	return float(opaque) / float(total)

func _dominant_color_ratio(image: Image) -> float:
	var width: int = image.get_width()
	var height: int = image.get_height()
	if width == 0 or height == 0:
		return 0.0
	var counts: Dictionary = {}
	var sample_step: int = 4
	var total: int = 0
	for y in range(0, height, sample_step):
		for x in range(0, width, sample_step):
			var color: Color = image.get_pixel(x, y)
			if color.a < 0.95:
				continue
			var key: String = "%d_%d_%d" % [int(color.r * 15.0), int(color.g * 15.0), int(color.b * 15.0)]
			counts[key] = int(counts.get(key, 0)) + 1
			total += 1
	if total == 0:
		return 0.0
	var max_count: int = 0
	for value in counts.values():
		var count: int = int(value)
		if count > max_count:
			max_count = count
	return float(max_count) / float(total)

func _border_alpha_ratio(image: Image, padding: int, alpha_threshold: float) -> float:
	var width: int = image.get_width()
	var height: int = image.get_height()
	var total: int = 0
	var solid: int = 0
	for y in range(padding):
		for x in range(width):
			total += 1
			if image.get_pixel(x, y).a > alpha_threshold:
				solid += 1
	for y in range(height - padding, height):
		for x in range(width):
			total += 1
			if image.get_pixel(x, y).a > alpha_threshold:
				solid += 1
	for y in range(padding, height - padding):
		for x in range(padding):
			total += 1
			if image.get_pixel(x, y).a > alpha_threshold:
				solid += 1
		for x in range(width - padding, width):
			total += 1
			if image.get_pixel(x, y).a > alpha_threshold:
				solid += 1
	if total == 0:
		return 0.0
	return float(solid) / float(total)

func _load_texture_image(texture: Texture2D, prop_path: String, label: String) -> Image:
	if texture == null:
		_push_error("%s texture missing" % label, prop_path)
		return null
	var image: Image = texture.get_image()
	if image != null and not image.is_empty():
		return image
	var resource_path: String = texture.resource_path
	if resource_path == "":
		_push_error("%s texture has empty resource_path" % label, prop_path)
		return null
	if not FileAccess.file_exists(resource_path):
		_push_error("%s texture resource_path missing on disk" % label, prop_path)
		return null
	var loaded: Image = Image.load_from_file(resource_path)
	if loaded == null or loaded.is_empty():
		_push_error("%s texture load_from_file failed" % label, prop_path)
		return null
	return loaded

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

func _push_error(message: String, prop_path: String) -> void:
	_had_errors = true
	_current_prop_errors = true
	push_error("[ArtQA] %s (%s)" % [message, prop_path])

func _push_warning(message: String, prop_path: String) -> void:
	_had_warnings = true
	_current_prop_warnings = true
	push_warning("[ArtQA] %s (%s)" % [message, prop_path])

func _prop_display_id(prop_def: PropDef, prop_path: String) -> String:
	if prop_def != null and prop_def.id != "":
		return prop_def.id
	return prop_path.get_file().get_basename()

func _finalize_prop_status(prop_id: String, prop_path: String) -> void:
	if _current_prop_errors:
		print("[ArtQA] FAIL %s (%s)" % [prop_id, prop_path])
	elif _current_prop_warnings:
		print("[ArtQA] WARN %s (%s)" % [prop_id, prop_path])
	else:
		print("[ArtQA] PASS %s" % prop_id)
