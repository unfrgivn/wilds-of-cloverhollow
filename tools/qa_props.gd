extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const PROPS_ROOT: String = "res://content/props"
const PROP_DEF_SCRIPT: Script = preload("res://game/props/prop_def.gd")
const PROP_INSTANCE_SCRIPT: Script = preload("res://game/props/prop_instance.gd")
const PipelineConstants: Script = preload("res://game/tools/pipeline_constants.gd")

const MIN_BLOCK_PIXELS: int = PipelineConstants.MIN_BLOCK_PIXELS
const ALPHA_THRESHOLD: float = PipelineConstants.ALPHA_THRESHOLD

var _had_errors: bool = false
var _had_warnings: bool = false

func _init() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var include_all: bool = args.has("--all")
	var scene_json_paths: Array[String] = _find_scene_json_paths()
	var referenced_defs: Array[String] = _collect_referenced_prop_defs(scene_json_paths)
	if include_all:
		referenced_defs = _merge_unique(referenced_defs, _collect_all_prop_defs())
	referenced_defs.sort()

	print("[PropQA] Scenes scanned: %d" % scene_json_paths.size())
	print("[PropQA] Props checked: %d" % referenced_defs.size())
	print("[PropQA] Mode: %s" % ("--all" if include_all else "referenced-only"))

	for prop_path in referenced_defs:
		_check_prop_def(prop_path)

	if _had_errors:
		quit(1)
	else:
		quit(0)

func _find_scene_json_paths() -> Array[String]:
	var found: Array[String] = []
	var folders: Array[String] = _list_dirs_sorted(SCENES_ROOT)
	for folder in folders:
		var scene_folder: String = SCENES_ROOT.path_join(folder)
		var json_path: String = scene_folder.path_join("scene.json")
		if FileAccess.file_exists(json_path):
			found.append(json_path)
	return found

func _collect_referenced_prop_defs(scene_json_paths: Array[String]) -> Array[String]:
	var defs: Array[String] = []
	for json_path in scene_json_paths:
		var file: FileAccess = FileAccess.open(json_path, FileAccess.READ)
		if file == null:
			push_error("[PropQA] Failed to read %s" % json_path)
			_had_errors = true
			continue
		var text: String = file.get_as_text()
		file.close()
		var parsed: Variant = JSON.parse_string(text)
		if typeof(parsed) != TYPE_DICTIONARY:
			push_error("[PropQA] Invalid JSON in %s" % json_path)
			_had_errors = true
			continue
		var data: Dictionary = parsed
		if not data.has("props") or typeof(data["props"]) != TYPE_ARRAY:
			push_error("[PropQA] Missing props array in %s" % json_path)
			_had_errors = true
			continue
		var props: Array = data["props"]
		for prop_entry in props:
			if typeof(prop_entry) != TYPE_DICTIONARY:
				push_error("[PropQA] Invalid prop entry in %s" % json_path)
				_had_errors = true
				continue
			var prop_data: Dictionary = prop_entry
			if not prop_data.has("def"):
				push_error("[PropQA] Missing prop def in %s" % json_path)
				_had_errors = true
				continue
			var def_path: String = str(prop_data["def"]).strip_edges()
			if def_path == "":
				push_error("[PropQA] Empty prop def in %s" % json_path)
				_had_errors = true
				continue
			defs.append(def_path)
	return _unique_sorted(defs)

func _collect_all_prop_defs() -> Array[String]:
	var defs: Array[String] = []
	_collect_def_paths(PROPS_ROOT, defs)
	defs = _unique_sorted(defs)
	return defs

func _collect_def_paths(folder: String, results: Array[String]) -> void:
	var entries: Array[String] = _list_dir_entries_sorted(folder)
	for entry in entries:
		var path: String = folder.path_join(entry)
		var is_dir: bool = DirAccess.dir_exists_absolute(path)
		if is_dir:
			_collect_def_paths(path, results)
		else:
			if entry.ends_with("_def.tres"):
				results.append(path)

func _check_prop_def(prop_path: String) -> void:
	var resource: Resource = ResourceLoader.load(prop_path)
	if resource == null:
		_report_error("Failed to load PropDef", prop_path, "load")
		return
	if resource.resource_path == "":
		_report_error("PropDef is unsaved", prop_path, "resource_path")
		return
	if resource.get_script() != PROP_DEF_SCRIPT:
		_report_error("Resource is not PropDef", prop_path, "script")
		return

	var prop_id: String = str(resource.get("id")).strip_edges()
	if prop_id == "":
		_report_error("PropDef.id missing", prop_path, "id")
		return

	var prefab: PackedScene = resource.get("prefab") as PackedScene
	if prefab == null:
		_report_error("PropDef.prefab missing", prop_path, "prefab")
		return
	if prefab.resource_path == "":
		_report_error("PropDef.prefab unsaved", prop_path, "prefab")
		return
	var instance: Node = prefab.instantiate()
	if instance == null:
		_report_error("Failed to instantiate prefab", prop_path, "prefab")
		return
	if not (instance is Node2D):
		_report_error("Prefab root must be Node2D", prop_path, "prefab")
		instance.free()
		return
	if instance.get_script() != PROP_INSTANCE_SCRIPT:
		_report_error("Prefab root must use PropInstance script", prop_path, "prefab")
		instance.free()
		return

	var blocks: bool = bool(resource.get("blocks_movement"))
	var footprint_mask: Texture2D = resource.get("footprint_mask") as Texture2D
	if blocks:
		if footprint_mask == null:
			_report_error("Blocking prop missing footprint_mask", prop_path, "footprint_mask")
			instance.free()
			return
		var footprint_image: Image = _load_footprint_image(prop_path, footprint_mask)
		if footprint_image == null:
			instance.free()
			return
		var width: int = footprint_image.get_width()
		var height: int = footprint_image.get_height()
		if width <= 0 or height <= 0:
			_report_error("Footprint image has invalid size", prop_path, "footprint_mask")
			instance.free()
			return
		var anchor: Vector2i = resource.get("footprint_anchor_px")
		if anchor.x < 0 or anchor.y < 0 or anchor.x >= width or anchor.y >= height:
			_report_error("Footprint anchor out of bounds", prop_path, "footprint_anchor_px")
			instance.free()
			return
		var blocked_pixels: int = _count_blocked_pixels(footprint_image)
		if blocked_pixels < MIN_BLOCK_PIXELS:
			_report_error("Footprint has too few blocking pixels", prop_path, "footprint_mask")
			instance.free()
			return
	else:
		if footprint_mask != null:
			_report_warning("Non-blocking prop has footprint_mask", prop_path, "footprint_mask")

	var has_overhang: bool = bool(resource.get("has_overhang"))
	if has_overhang:
		if not (instance as Node2D).has_node("OverhangSprite"):
			_report_warning("PropDef.has_overhang true but OverhangSprite missing", prop_path, "has_overhang")

	print("[PropQA] PASS %s" % prop_path)
	instance.free()

func _count_blocked_pixels(image: Image) -> int:
	var width: int = image.get_width()
	var height: int = image.get_height()
	var count: int = 0
	for y in range(height):
		for x in range(width):
			if image.get_pixel(x, y).a > ALPHA_THRESHOLD:
				count += 1
	return count

func _load_footprint_image(prop_path: String, texture: Texture2D) -> Image:
	var footprint_path: String = texture.resource_path
	if footprint_path == "":
		_report_error("Footprint texture has no resource_path", prop_path, "footprint_mask")
		return null
	var absolute_path: String = ProjectSettings.globalize_path(footprint_path)
	var image: Image = Image.load_from_file(absolute_path)
	if image == null or image.is_empty():
		_report_error("Footprint load failed (load_from_file)", prop_path, "footprint_mask", footprint_path)
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

func _list_dir_entries_sorted(folder: String) -> Array[String]:
	var dir: DirAccess = DirAccess.open(folder)
	if dir == null:
		return []
	var entries: Array[String] = []
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		if not entry.begins_with("."):
			entries.append(entry)
		entry = dir.get_next()
	dir.list_dir_end()
	entries.sort()
	return entries

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
	merged.append_array(b)
	return _unique_sorted(merged)

func _report_error(message: String, prop_path: String, field: String, extra: String = "") -> void:
	_had_errors = true
	if extra == "":
		push_error("[PropQA] FAIL %s (%s) field=%s" % [prop_path, message, field])
	else:
		push_error("[PropQA] FAIL %s (%s) field=%s path=%s" % [prop_path, message, field, extra])

func _report_warning(message: String, prop_path: String, field: String) -> void:
	_had_warnings = true
	push_warning("[PropQA] WARN %s (%s) field=%s" % [prop_path, message, field])
