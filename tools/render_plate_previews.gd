extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const OUTPUT_NAME: String = "plate_preview.png"
const FLAG_SCENE: String = "--scene"

var _had_errors: bool = false

func _init() -> void:
	_run()

func _run() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var scene_ids: Array[String] = _parse_scene_args(args)
	if scene_ids.is_empty():
		scene_ids = _find_scene_ids()
	if scene_ids.is_empty():
		push_warning("[PlatePreview] No scenes found")
		quit(0)
		return
	for scene_id in scene_ids:
		_render_scene(scene_id)
	quit(1 if _had_errors else 0)

func _parse_scene_args(args: PackedStringArray) -> Array[String]:
	var ids: Array[String] = []
	for index in range(args.size()):
		if args[index] != FLAG_SCENE:
			continue
		if index + 1 >= args.size():
			continue
		ids.append(args[index + 1])
	return ids

func _find_scene_ids() -> Array[String]:
	var dir: DirAccess = DirAccess.open(SCENES_ROOT)
	if dir == null:
		return []
	var ids: Array[String] = []
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		if dir.current_is_dir() and not entry.begins_with("."):
			var scene_path: String = SCENES_ROOT.path_join(entry).path_join("scene.json")
			if FileAccess.file_exists(scene_path):
				ids.append(entry)
		entry = dir.get_next()
	dir.list_dir_end()
	ids.sort()
	return ids

func _render_scene(scene_id: String) -> void:
	var scene_path: String = SCENES_ROOT.path_join(scene_id).path_join("scene.json")
	if not FileAccess.file_exists(scene_path):
		_push_error("Missing scene.json", scene_path)
		return
	var data: Dictionary = _load_scene_json(scene_path)
	if data.is_empty():
		return
	var assets: Dictionary = data.get("assets", {})
	var base_path: String = str(assets.get("plate_base", "")).strip_edges()
	if base_path == "":
		base_path = str(assets.get("ground", "")).strip_edges()
	if base_path == "":
		_push_error("Missing plate_base/ground", scene_path)
		return
	var base_image: Image = _load_image(base_path)
	if base_image == null or base_image.is_empty():
		_push_error("Failed to load plate_base", base_path)
		return
	var output: Image = base_image.duplicate()
	var overhang_path: String = str(assets.get("plate_overhang", "")).strip_edges()
	if overhang_path != "":
		var overhang_image: Image = _load_image(overhang_path)
		if overhang_image != null and not overhang_image.is_empty():
			if overhang_image.get_size() != output.get_size():
				overhang_image.resize(output.get_width(), output.get_height(), Image.INTERPOLATE_BILINEAR)
			output.blend_rect(overhang_image, Rect2i(Vector2i.ZERO, overhang_image.get_size()), Vector2i.ZERO)
	var output_path: String = SCENES_ROOT.path_join(scene_id).path_join("_baked").path_join(OUTPUT_NAME)
	var output_dir: String = output_path.get_base_dir()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output_dir))
	var save_error: Error = output.save_png(ProjectSettings.globalize_path(output_path))
	if save_error != OK:
		_push_error("Failed to save preview", output_path)
		return
	print("[PlatePreview] Wrote %s" % output_path)

func _load_scene_json(path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		_push_error("Failed to read scene.json", path)
		return {}
	var text: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		_push_error("Invalid scene.json", path)
		return {}
	return parsed

func _load_image(path: String) -> Image:
	var absolute_path: String = ProjectSettings.globalize_path(path)
	return Image.load_from_file(absolute_path)

func _push_error(message: String, detail: String) -> void:
	_had_errors = true
	push_error("[PlatePreview] %s (%s)" % [message, detail])
