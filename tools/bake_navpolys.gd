extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const PipelineConstants: Script = preload("res://game/tools/pipeline_constants.gd")

const NPC_RADIUS_PX: int = PipelineConstants.NPC_RADIUS_PX
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
	if not assets.has("walkmask_raw") or not assets.has("navpoly"):
		_push_error("Missing navpoly or walkmask_raw path", scene_path)
		return
	var walkmask_path: String = str(assets["walkmask_raw"]).strip_edges()
	if walkmask_path == "":
		_push_error("walkmask_raw path empty", scene_path)
		return
	if not FileAccess.file_exists(walkmask_path):
		_push_error("walkmask_raw missing: %s" % walkmask_path, scene_path)
		return

	var absolute_path: String = ProjectSettings.globalize_path(walkmask_path)
	var image: Image = Image.load_from_file(absolute_path)
	if image == null or image.is_empty():
		_push_error("Failed to load walkmask_raw: %s" % walkmask_path, scene_path)
		return

	var bitmap: BitMap = _create_walkable_bitmap(image)
	var rect: Rect2i = Rect2i(Vector2i.ZERO, image.get_size())
	var outlines: Array = bitmap.opaque_to_polygons(rect, 2.0)
	if outlines.is_empty():
		_push_error("No walkable polygons found", scene_path)
		return

	var navpoly: NavigationPolygon = NavigationPolygon.new()
	navpoly.agent_radius = NPC_RADIUS_PX
	var source_data: NavigationMeshSourceGeometryData2D = NavigationMeshSourceGeometryData2D.new()
	for outline in outlines:
		var poly: PackedVector2Array = outline
		source_data.add_traversable_outline(poly)
	NavigationServer2D.bake_from_source_geometry_data(navpoly, source_data)

	var navpoly_path: String = str(assets["navpoly"]).strip_edges()

	if navpoly_path == "":
		_push_error("navpoly path empty", scene_path)
		return
	DirAccess.make_dir_recursive_absolute(navpoly_path.get_base_dir())
	var save_error: Error = ResourceSaver.save(navpoly, navpoly_path)
	if save_error != OK:
		_push_error("Failed to save navpoly: %s" % navpoly_path, scene_path)
		return

	print("[BakeNavpoly] %s" % scene_path)


func _create_walkable_bitmap(image: Image) -> BitMap:
	var size: Vector2i = image.get_size()
	var bitmap: BitMap = BitMap.new()
	bitmap.create(size)
	for y in range(size.y):
		for x in range(size.x):
			var pixel: Color = image.get_pixel(x, y)
			var luminance: float = (pixel.r + pixel.g + pixel.b) / 3.0
			var walkable: bool = luminance >= WALKABLE_THRESHOLD and pixel.a >= ALPHA_THRESHOLD
			bitmap.set_bitv(Vector2i(x, y), walkable)
	return bitmap

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
	push_error("[BakeNavpoly] %s (%s)" % [message, scene_path])
