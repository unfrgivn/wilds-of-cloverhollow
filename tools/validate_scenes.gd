extends SceneTree

const PipelineConstants: Script = preload("res://game/tools/pipeline_constants.gd")

const WALKABLE_LUMINANCE: float = PipelineConstants.WALKABLE_THRESHOLD
const WALKABLE_ALPHA: float = PipelineConstants.ALPHA_THRESHOLD
const REACHABILITY_STEP: int = 4
const EXIT_SAMPLE_STEP: int = 8

var _had_failure: bool = false
var _scene_index: Dictionary = {}

func _init() -> void:
	var scene_files: Array[String] = _collect_scene_files("res://content/scenes")
	var layout_files: Array[String] = _collect_layout_files("res://content/scenes")
	_scene_index = _build_scene_index(scene_files)
	_validate_layout_scene_pairs(layout_files, scene_files)
	for scene_path in scene_files:
		_validate_scene(scene_path, _scene_index)
	if _had_failure:
		quit(1)
		return
	print("[Validator] PASS: All scenes validated")
	quit(0)

func _collect_scene_files(root: String) -> Array[String]:
	var scene_paths: Array[String] = []
	var folders: Array[String] = _list_dirs_sorted(root)
	for entry in folders:
		var folder: String = root.path_join(entry)
		var scene_path: String = folder.path_join("scene.json")
		if FileAccess.file_exists(scene_path):
			scene_paths.append(scene_path)
	return scene_paths

func _collect_layout_files(root: String) -> Array[String]:
	var layout_paths: Array[String] = []
	var folders: Array[String] = _list_dirs_sorted(root)
	for entry in folders:
		var folder: String = root.path_join(entry)
		var layout_path: String = folder.path_join("layout.tscn")
		if FileAccess.file_exists(layout_path):
			layout_paths.append(layout_path)
	return layout_paths

func _build_scene_index(scene_paths: Array[String]) -> Dictionary:
	var index: Dictionary = {}
	for scene_path in scene_paths:
		var data: Dictionary = _load_json(scene_path)
		if data.is_empty():
			continue
		var scene_id: String = str(data.get("scene_id", "")).strip_edges()
		if scene_id == "":
			push_error("[Validator] Missing scene_id for %s" % scene_path)
			_had_failure = true
			continue
		var spawn_ids: Dictionary = {}
		if data.has("player_spawn") and typeof(data["player_spawn"]) == TYPE_DICTIONARY:
			var spawn_data: Dictionary = data["player_spawn"]
			if spawn_data.has("id"):
				var spawn_id: String = str(spawn_data["id"]).strip_edges()
				if spawn_id != "":
					spawn_ids[spawn_id] = true
		index[scene_id] = {"path": scene_path, "spawns": spawn_ids}
	return index

func _validate_layout_scene_pairs(layout_paths: Array[String], scene_paths: Array[String]) -> void:
	var scene_lookup: Dictionary = {}
	for scene_path in scene_paths:
		scene_lookup[scene_path.get_base_dir()] = true
	for layout_path in layout_paths:
		var folder: String = layout_path.get_base_dir()
		if not scene_lookup.has(folder):
			push_error("[Validator] Missing scene.json for layout: %s" % layout_path)
			_had_failure = true

func _validate_scene(scene_path: String, scene_index: Dictionary) -> void:
	print("[Validator] Checking %s" % scene_path)
	var data: Dictionary = _load_json(scene_path)
	if data.is_empty():
		return
	if not _require_keys(data, ["scene_id", "size_px", "assets", "player_spawn", "props", "decals", "hotspots", "exits"], scene_path):
		return

	var folder: String = scene_path.get_base_dir()
	var size_px: Vector2i = _parse_size(data["size_px"], scene_path)
	if size_px == Vector2i.ZERO:
		return

	var assets: Dictionary = data["assets"]
	if not _require_keys(assets, ["ground", "plate_base", "plate_overhang", "walkmask_raw", "walkmask_player", "navpoly"], scene_path):
		return
	var ground_path: String = _resolve_path(folder, assets["ground"])
	var plate_base_path: String = _resolve_path(folder, assets["plate_base"])
	var plate_overhang_path: String = _resolve_path(folder, assets["plate_overhang"])
	var raw_path: String = _resolve_path(folder, assets["walkmask_raw"])
	var player_path: String = _resolve_path(folder, assets["walkmask_player"])
	var navpoly_path: String = _resolve_path(folder, assets["navpoly"])
	_check_file_exists(ground_path, scene_path)
	_check_file_exists(plate_base_path, scene_path)
	_check_file_exists(plate_overhang_path, scene_path)
	_check_file_exists(raw_path, scene_path)
	_check_file_exists(player_path, scene_path)
	_check_file_exists(navpoly_path, scene_path)
	if assets.has("base_walkmask"):
		var base_path: String = _resolve_path(folder, assets["base_walkmask"])
		_check_file_exists(base_path, scene_path)

	var walkmask: Image = _load_image_from_path(player_path, scene_path, "walkmask_player")
	if walkmask == null:
		return
	if walkmask.get_size() != size_px:
		push_error("[Validator] size_px does not match walkmask_player (%s)" % scene_path)
		_had_failure = true

	var ground_image: Image = _load_image_from_path(ground_path, scene_path, "ground")
	if ground_image != null:
		if ground_image.get_size() != size_px:
			push_warning("[Validator] ground size does not match size_px (%s)" % scene_path)
		_warn_if_ground_high_contrast(ground_image, scene_path)

	var spawn_data: Dictionary = data["player_spawn"]
	if not _require_keys(spawn_data, ["id", "pos"], scene_path):
		return
	var spawn_pos: Vector2 = _parse_pos(spawn_data["pos"], scene_path, "player_spawn")
	_check_point_bounds(spawn_pos, size_px, "player_spawn", scene_path)
	_check_point_walkable(walkmask, spawn_pos, "player_spawn", scene_path)

	var decals: Array = data["decals"]
	for decal_data in decals:
		if typeof(decal_data) != TYPE_DICTIONARY:
			push_error("[Validator] Invalid decal entry (%s)" % scene_path)
			_had_failure = true
			continue
		if not _require_keys(decal_data, ["id", "texture", "pos", "size", "z_index"], scene_path):
			continue
		var decal_pos: Vector2 = _parse_pos(decal_data["pos"], scene_path, "decal")
		var decal_size: Vector2 = _parse_pos(decal_data["size"], scene_path, "decal_size")
		if decal_size.x <= 0.0 or decal_size.y <= 0.0:
			push_error("[Validator] Invalid decal size (%s)" % scene_path)
			_had_failure = true
			continue
		var z_index_type: int = typeof(decal_data["z_index"])
		if z_index_type != TYPE_INT and z_index_type != TYPE_FLOAT:
			push_error("[Validator] Invalid decal z_index (%s)" % scene_path)
			_had_failure = true
			continue
		var decal_rect: Rect2 = Rect2(decal_pos, decal_size)
		_check_rect_bounds(decal_rect, size_px, "decal:%s" % str(decal_data["id"]), scene_path)
		var decal_texture: String = _resolve_path(folder, decal_data["texture"])
		_check_file_exists(decal_texture, scene_path)

	var hotspots: Array = data["hotspots"]
	for hotspot_data in hotspots:
		if typeof(hotspot_data) != TYPE_DICTIONARY:
			push_error("[Validator] Invalid hotspot entry (%s)" % scene_path)
			_had_failure = true
			continue
		if not _require_keys(hotspot_data, ["id", "pos", "radius"], scene_path):
			continue
		var point: Vector2 = _parse_pos(hotspot_data["pos"], scene_path, "hotspot")
		var radius: float = float(hotspot_data["radius"])
		if radius <= 0.0:
			push_error("[Validator] %s hotspot radius must be > 0 (%s)" % [scene_path, hotspot_data["id"]])
			_had_failure = true
			continue
		var label: String = "hotspot:%s" % str(hotspot_data["id"])
		_check_point_bounds(point, size_px, label, scene_path)
		_check_point_walkable(walkmask, point, label, scene_path)

	var exits: Array = data["exits"]
	for exit_data in exits:
		if typeof(exit_data) != TYPE_DICTIONARY:
			push_error("[Validator] Invalid exit entry (%s)" % scene_path)
			_had_failure = true
			continue
		if not _require_keys(exit_data, ["id", "rect", "target"], scene_path):
			continue
		var rect: Rect2 = _parse_rect(exit_data["rect"], scene_path, "exit")
		if rect.size.x <= 0.0 or rect.size.y <= 0.0:
			push_error("[Validator] %s exit rect has non-positive size (%s)" % [scene_path, exit_data["id"]])
			_had_failure = true
			continue
		var label_exit: String = "exit:%s" % str(exit_data["id"])
		_check_rect_bounds(rect, size_px, label_exit, scene_path)
		_check_exit_walkable(walkmask, rect, label_exit, scene_path)
		var target: Dictionary = exit_data["target"]
		if typeof(target) != TYPE_DICTIONARY:
			push_error("[Validator] %s exit target invalid (%s)" % [scene_path, exit_data["id"]])
			_had_failure = true
			continue
		if not _require_keys(target, ["scene_id", "spawn_id"], scene_path):
			continue
		var target_scene_id: String = str(target["scene_id"]).strip_edges()
		var target_spawn_id: String = str(target["spawn_id"]).strip_edges()
		if target_scene_id == "":
			push_error("[Validator] %s exit target scene empty (%s)" % [scene_path, exit_data["id"]])
			_had_failure = true
		elif not scene_index.has(target_scene_id):
			push_error("[Validator] %s exit target scene missing (%s)" % [scene_path, target_scene_id])
			_had_failure = true
		else:
			var target_info: Dictionary = scene_index[target_scene_id]
			var spawns: Dictionary = target_info.get("spawns", {})
			if target_spawn_id == "" or not spawns.has(target_spawn_id):
				push_error("[Validator] %s exit target spawn missing (%s:%s)" % [scene_path, target_scene_id, target_spawn_id])
				_had_failure = true

	_check_reachability(walkmask, spawn_pos, hotspots, exits, scene_path)

func _warn_if_ground_high_contrast(image: Image, scene_path: String) -> void:
	var width: int = image.get_width()
	var height: int = image.get_height()
	if width <= 1 or height <= 1:
		return
	var sample_step: int = 4
	var high_edges: int = 0
	var total: int = 0
	for y in range(0, height - 1, sample_step):
		for x in range(0, width - 1, sample_step):
			var c: Color = image.get_pixel(x, y)
			var right: Color = image.get_pixel(x + 1, y)
			var down: Color = image.get_pixel(x, y + 1)
			var lum: float = (c.r + c.g + c.b) / 3.0
			var lum_right: float = (right.r + right.g + right.b) / 3.0
			var lum_down: float = (down.r + down.g + down.b) / 3.0
			var diff: float = max(abs(lum - lum_right), abs(lum - lum_down))
			if diff > 0.6:
				high_edges += 1
			total += 1
	if total == 0:
		return
	var ratio: float = float(high_edges) / float(total)
	if ratio > 0.2:
		push_warning("[Validator] ground has high-contrast edges (check for vertical art): %s" % scene_path)

func _load_json(scene_path: String) -> Dictionary:
	var file: FileAccess = FileAccess.open(scene_path, FileAccess.READ)
	if file == null:
		push_error("[Validator] Missing file: %s" % scene_path)
		_had_failure = true
		return {}
	var text: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("[Validator] Invalid JSON: %s" % scene_path)
		_had_failure = true
		return {}
	return parsed as Dictionary

func _parse_size(value: Variant, scene_path: String) -> Vector2i:
	if typeof(value) != TYPE_ARRAY:
		push_error("[Validator] Invalid size_px (%s)" % scene_path)
		_had_failure = true
		return Vector2i.ZERO
	var arr: Array = value
	if arr.size() != 2:
		push_error("[Validator] Invalid size_px length (%s)" % scene_path)
		_had_failure = true
		return Vector2i.ZERO
	return Vector2i(int(arr[0]), int(arr[1]))

func _parse_pos(value: Variant, scene_path: String, label: String) -> Vector2:
	if typeof(value) != TYPE_ARRAY:
		push_error("[Validator] Invalid pos for %s (%s)" % [label, scene_path])
		_had_failure = true
		return Vector2.ZERO
	var arr: Array = value
	if arr.size() != 2:
		push_error("[Validator] Invalid pos length for %s (%s)" % [label, scene_path])
		_had_failure = true
		return Vector2.ZERO
	return Vector2(float(arr[0]), float(arr[1]))

func _parse_rect(value: Variant, scene_path: String, label: String) -> Rect2:
	if typeof(value) != TYPE_ARRAY:
		push_error("[Validator] Invalid rect for %s (%s)" % [label, scene_path])
		_had_failure = true
		return Rect2()
	var arr: Array = value
	if arr.size() != 4:
		push_error("[Validator] Invalid rect length for %s (%s)" % [label, scene_path])
		_had_failure = true
		return Rect2()
	return Rect2(float(arr[0]), float(arr[1]), float(arr[2]), float(arr[3]))

func _resolve_path(folder: String, value: Variant) -> String:
	var path: String = str(value).strip_edges()
	if path == "":
		return ""
	if path.begins_with("res://"):
		return path
	return folder.path_join(path)

func _load_image_from_path(path: String, scene_path: String, label: String) -> Image:
	var texture: Texture2D = ResourceLoader.load(path) as Texture2D
	if texture != null:
		var tex_image: Image = texture.get_image()
		if tex_image != null and not tex_image.is_empty():
			return tex_image
	var fallback: Image = Image.load_from_file(path)
	if fallback == null or fallback.is_empty():
		push_error("[Validator] Failed to load %s: %s (%s)" % [label, path, scene_path])
		_had_failure = true
		return null
	return fallback

func _require_keys(dict: Dictionary, keys: Array[String], scene_path: String) -> bool:
	for key in keys:
		if not dict.has(key):
			push_error("[Validator] %s missing key: %s" % [scene_path, key])
			_had_failure = true
			return false
	return true

func _check_file_exists(path: String, scene_path: String) -> void:
	if path == "":
		push_error("[Validator] Empty asset path (%s)" % scene_path)
		_had_failure = true
		return
	if not FileAccess.file_exists(path):
		push_error("[Validator] Missing asset (%s): %s" % [scene_path, path])
		_had_failure = true

func _check_point_bounds(point: Vector2, size: Vector2i, label: String, scene_path: String) -> void:
	if point.x < 0.0 or point.y < 0.0 or point.x >= size.x or point.y >= size.y:
		push_error("[Validator] %s out of bounds (%s)" % [scene_path, label])
		_had_failure = true

func _check_rect_bounds(rect: Rect2, size: Vector2i, label: String, scene_path: String) -> void:
	if rect.position.x < 0.0 or rect.position.y < 0.0:
		push_error("[Validator] %s out of bounds (%s)" % [scene_path, label])
		_had_failure = true
		return
	if rect.position.x + rect.size.x > size.x or rect.position.y + rect.size.y > size.y:
		push_error("[Validator] %s out of bounds (%s)" % [scene_path, label])
		_had_failure = true

func _check_point_walkable(image: Image, point: Vector2, label: String, scene_path: String) -> void:
	var color: Color = image.get_pixel(int(point.x), int(point.y))
	if not _is_walkable(color):
		push_error("[Validator] %s not walkable (%s)" % [scene_path, label])
		_had_failure = true

func _check_exit_walkable(image: Image, rect: Rect2, label: String, scene_path: String) -> void:
	var found_walkable: bool = false
	var start_x: int = int(rect.position.x)
	var start_y: int = int(rect.position.y)
	var end_x: int = int(rect.position.x + rect.size.x)
	var end_y: int = int(rect.position.y + rect.size.y)
	for x in range(start_x, end_x, EXIT_SAMPLE_STEP):
		for y in range(start_y, end_y, EXIT_SAMPLE_STEP):
			var color: Color = image.get_pixel(x, y)
			if _is_walkable(color):
				found_walkable = true
				break
		if found_walkable:
			break
	if not found_walkable:
		push_error("[Validator] %s exit has no walkable pixels (%s)" % [scene_path, label])
		_had_failure = true

func _check_reachability(image: Image, spawn: Vector2, hotspots: Array, exits: Array, scene_path: String) -> void:
	var size: Vector2i = image.get_size()
	var grid_width: int = int(ceil(float(size.x) / float(REACHABILITY_STEP)))
	var grid_height: int = int(ceil(float(size.y) / float(REACHABILITY_STEP)))
	var visited: Dictionary = {}
	var queue: Array[Vector2i] = []
	var start_cell: Vector2i = _cell_for_point(spawn)
	queue.append(start_cell)
	visited[_cell_key(start_cell)] = true
	while not queue.is_empty():
		var cell: Vector2i = queue.pop_front()
		for offset in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var next: Vector2i = cell + offset
			if next.x < 0 or next.y < 0 or next.x >= grid_width or next.y >= grid_height:
				continue
			var key: String = _cell_key(next)
			if visited.has(key):
				continue
			var sample: Vector2 = _cell_center(next)
			if not _is_point_walkable(image, sample):
				continue
			visited[key] = true
			queue.append(next)

	for hotspot_data in hotspots:
		if typeof(hotspot_data) != TYPE_DICTIONARY:
			continue
		if not hotspot_data.has("id") or not hotspot_data.has("pos"):
			continue
		var point: Vector2 = _parse_pos(hotspot_data["pos"], scene_path, "hotspot")
		var cell: Vector2i = _cell_for_point(point)
		if not visited.has(_cell_key(cell)):
			push_error("[Validator] %s unreachable hotspot: %s" % [scene_path, hotspot_data["id"]])
			_had_failure = true

	for exit_data in exits:
		if typeof(exit_data) != TYPE_DICTIONARY:
			continue
		if not exit_data.has("id") or not exit_data.has("rect"):
			continue
		var rect: Rect2 = _parse_rect(exit_data["rect"], scene_path, "exit")
		var reachable: bool = false
		for key in visited.keys():
			var cell_pos: Vector2i = _cell_from_key(key)
			var point: Vector2 = _cell_center(cell_pos)
			if rect.has_point(point) and _is_point_walkable(image, point):
				reachable = true
				break
		if not reachable:
			push_error("[Validator] %s unreachable exit: %s" % [scene_path, exit_data["id"]])
			_had_failure = true

func _is_point_walkable(image: Image, point: Vector2) -> bool:
	if point.x < 0.0 or point.y < 0.0:
		return false
	if point.x >= image.get_width() or point.y >= image.get_height():
		return false
	var color: Color = image.get_pixel(int(point.x), int(point.y))
	return _is_walkable(color)

func _is_walkable(color: Color) -> bool:
	var luminance: float = (color.r + color.g + color.b) / 3.0
	return luminance >= WALKABLE_LUMINANCE and color.a >= WALKABLE_ALPHA

func _cell_for_point(point: Vector2) -> Vector2i:
	return Vector2i(int(point.x / REACHABILITY_STEP), int(point.y / REACHABILITY_STEP))

func _cell_center(cell: Vector2i) -> Vector2:
	return Vector2(float(cell.x * REACHABILITY_STEP + REACHABILITY_STEP / 2), float(cell.y * REACHABILITY_STEP + REACHABILITY_STEP / 2))

func _cell_key(cell: Vector2i) -> String:
	return "%d,%d" % [cell.x, cell.y]

func _cell_from_key(key: String) -> Vector2i:
	var parts: PackedStringArray = key.split(",")
	if parts.size() != 2:
		return Vector2i.ZERO
	return Vector2i(int(parts[0]), int(parts[1]))

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
