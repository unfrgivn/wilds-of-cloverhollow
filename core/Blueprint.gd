extends RefCounted
class_name Blueprint

var scene_id: String = ""
var size_px: Vector2i = Vector2i.ZERO
var assets: Dictionary = {}
var player_spawn: Dictionary = {}
var props: Array[Dictionary] = []
var decals: Array[Dictionary] = []
var hotspots: Array[Dictionary] = []
var exits: Array[Dictionary] = []

static func load_from_scene_folder(folder_path: String) -> Blueprint:
	var blueprint: Blueprint = Blueprint.new()
	var scene_path: String = folder_path.path_join("scene.json")
	var file: FileAccess = FileAccess.open(scene_path, FileAccess.READ)
	if file == null:
		push_error("[Blueprint] Missing scene.json at %s" % scene_path)
		return null
	var text: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("[Blueprint] Invalid JSON in %s" % scene_path)
		return null
	var data: Dictionary = parsed as Dictionary
	if not _require_key(data, "scene_id"):
		return null
	if not _require_key(data, "size_px"):
		return null
	if not _require_key(data, "assets"):
		return null
	if not _require_key(data, "player_spawn"):
		return null
	if not _require_key(data, "props"):
		return null
	if not _require_key(data, "decals"):
		return null
	if not _require_key(data, "hotspots"):
		return null
	if not _require_key(data, "exits"):
		return null

	blueprint.scene_id = str(data["scene_id"])

	var size_arr: Variant = data["size_px"]
	if typeof(size_arr) != TYPE_ARRAY or size_arr.size() != 2:
		push_error("[Blueprint] Invalid size_px in %s" % scene_path)
		return null
	blueprint.size_px = Vector2i(int(size_arr[0]), int(size_arr[1]))

	var assets_data: Dictionary = data["assets"]
	if not _require_key(assets_data, "ground"):
		return null
	if not _require_key(assets_data, "walkmask_raw"):
		return null
	if not _require_key(assets_data, "walkmask_player"):
		return null
	if not _require_key(assets_data, "navpoly"):
		return null
	var normalized_assets: Dictionary = {}
	normalized_assets["ground"] = _normalize_path(folder_path, assets_data["ground"])
	normalized_assets["walkmask_raw"] = _normalize_path(folder_path, assets_data["walkmask_raw"])
	normalized_assets["walkmask_player"] = _normalize_path(folder_path, assets_data["walkmask_player"])
	normalized_assets["navpoly"] = _normalize_path(folder_path, assets_data["navpoly"])
	if assets_data.has("base_walkmask"):
		normalized_assets["base_walkmask"] = _normalize_path(folder_path, assets_data["base_walkmask"])
	blueprint.assets = normalized_assets

	if typeof(data["player_spawn"]) != TYPE_DICTIONARY:
		push_error("[Blueprint] Invalid player_spawn in %s" % scene_path)
		return null
	var spawn_data: Dictionary = data["player_spawn"]
	if not _require_key(spawn_data, "id"):
		return null
	if not _require_key(spawn_data, "pos"):
		return null
	var spawn_pos_arr: Variant = spawn_data["pos"]
	if typeof(spawn_pos_arr) != TYPE_ARRAY or spawn_pos_arr.size() != 2:
		push_error("[Blueprint] Invalid player_spawn.pos in %s" % scene_path)
		return null
	var spawn_pos: Vector2 = Vector2(float(spawn_pos_arr[0]), float(spawn_pos_arr[1]))
	blueprint.player_spawn = {"id": str(spawn_data["id"]), "pos": spawn_pos}

	if typeof(data["props"]) != TYPE_ARRAY:
		push_error("[Blueprint] Invalid props array in %s" % scene_path)
		return null
	blueprint.props.clear()
	for prop_entry in data["props"]:
		if typeof(prop_entry) != TYPE_DICTIONARY:
			push_error("[Blueprint] Invalid prop entry in %s" % scene_path)
			return null
		var prop_data: Dictionary = prop_entry
		if not _require_key(prop_data, "def"):
			return null
		if not _require_key(prop_data, "pos"):
			return null
		var pos_arr: Variant = prop_data["pos"]
		if typeof(pos_arr) != TYPE_ARRAY or pos_arr.size() != 2:
			push_error("[Blueprint] Invalid prop pos in %s" % scene_path)
			return null
		var normalized_prop: Dictionary = {}
		normalized_prop["def"] = _normalize_path(folder_path, prop_data["def"])
		normalized_prop["pos"] = Vector2(float(pos_arr[0]), float(pos_arr[1]))
		normalized_prop["variant"] = int(prop_data.get("variant", 0))
		blueprint.props.append(normalized_prop)

	if typeof(data["decals"]) != TYPE_ARRAY:
		push_error("[Blueprint] Invalid decals array in %s" % scene_path)
		return null
	blueprint.decals.clear()
	for decal_entry in data["decals"]:
		if typeof(decal_entry) != TYPE_DICTIONARY:
			push_error("[Blueprint] Invalid decal entry in %s" % scene_path)
			return null
		var decal_data: Dictionary = decal_entry
		if not _require_key(decal_data, "id"):
			return null
		if not _require_key(decal_data, "texture"):
			return null
		if not _require_key(decal_data, "pos"):
			return null
		if not _require_key(decal_data, "size"):
			return null
		if not _require_key(decal_data, "z_index"):
			return null
		var decal_pos_arr: Variant = decal_data["pos"]
		if typeof(decal_pos_arr) != TYPE_ARRAY or decal_pos_arr.size() != 2:
			push_error("[Blueprint] Invalid decal pos in %s" % scene_path)
			return null
		var decal_size_arr: Variant = decal_data["size"]
		if typeof(decal_size_arr) != TYPE_ARRAY or decal_size_arr.size() != 2:
			push_error("[Blueprint] Invalid decal size in %s" % scene_path)
			return null
		var normalized_decal: Dictionary = {}
		normalized_decal["id"] = str(decal_data["id"])
		normalized_decal["texture"] = _normalize_path(folder_path, decal_data["texture"])
		normalized_decal["pos"] = Vector2(float(decal_pos_arr[0]), float(decal_pos_arr[1]))
		normalized_decal["size"] = Vector2(float(decal_size_arr[0]), float(decal_size_arr[1]))
		normalized_decal["z_index"] = int(decal_data["z_index"])
		blueprint.decals.append(normalized_decal)

	if typeof(data["hotspots"]) != TYPE_ARRAY:
		push_error("[Blueprint] Invalid hotspots array in %s" % scene_path)
		return null
	blueprint.hotspots.clear()
	for hotspot_entry in data["hotspots"]:
		if typeof(hotspot_entry) != TYPE_DICTIONARY:
			push_error("[Blueprint] Invalid hotspot entry in %s" % scene_path)
			return null
		var hotspot_data: Dictionary = hotspot_entry
		if not _require_key(hotspot_data, "id"):
			return null
		if not _require_key(hotspot_data, "type"):
			return null
		if not _require_key(hotspot_data, "pos"):
			return null
		if not _require_key(hotspot_data, "radius"):
			return null
		var hotspot_pos_arr: Variant = hotspot_data["pos"]
		if typeof(hotspot_pos_arr) != TYPE_ARRAY or hotspot_pos_arr.size() != 2:
			push_error("[Blueprint] Invalid hotspot pos in %s" % scene_path)
			return null
		var normalized_hotspot: Dictionary = {}
		normalized_hotspot["id"] = str(hotspot_data["id"])
		normalized_hotspot["type"] = str(hotspot_data["type"])
		normalized_hotspot["pos"] = Vector2(float(hotspot_pos_arr[0]), float(hotspot_pos_arr[1]))
		normalized_hotspot["radius"] = float(hotspot_data["radius"])
		if hotspot_data.has("text"):
			normalized_hotspot["text"] = str(hotspot_data["text"])
		blueprint.hotspots.append(normalized_hotspot)

	if typeof(data["exits"]) != TYPE_ARRAY:
		push_error("[Blueprint] Invalid exits array in %s" % scene_path)
		return null
	blueprint.exits.clear()
	for exit_entry in data["exits"]:
		if typeof(exit_entry) != TYPE_DICTIONARY:
			push_error("[Blueprint] Invalid exit entry in %s" % scene_path)
			return null
		var exit_data: Dictionary = exit_entry
		if not _require_key(exit_data, "id"):
			return null
		if not _require_key(exit_data, "rect"):
			return null
		if not _require_key(exit_data, "target"):
			return null
		var rect_arr: Variant = exit_data["rect"]
		if typeof(rect_arr) != TYPE_ARRAY or rect_arr.size() != 4:
			push_error("[Blueprint] Invalid exit rect in %s" % scene_path)
			return null
		var target_data: Variant = exit_data["target"]
		if typeof(target_data) != TYPE_DICTIONARY:
			push_error("[Blueprint] Invalid exit target in %s" % scene_path)
			return null
		var target_dict: Dictionary = target_data
		if not _require_key(target_dict, "scene_id"):
			return null
		if not _require_key(target_dict, "spawn_id"):
			return null
		var normalized_exit: Dictionary = {}
		normalized_exit["id"] = str(exit_data["id"])
		normalized_exit["rect"] = Rect2(
			float(rect_arr[0]),
			float(rect_arr[1]),
			float(rect_arr[2]),
			float(rect_arr[3])
		)
		normalized_exit["target"] = {
			"scene_id": str(target_dict["scene_id"]),
			"spawn_id": str(target_dict["spawn_id"])
		}
		blueprint.exits.append(normalized_exit)

	return blueprint

static func _normalize_path(folder_path: String, path_value: Variant) -> String:
	var path: String = str(path_value).strip_edges()
	if path == "":
		return ""
	if path.begins_with("res://"):
		return path
	return folder_path.path_join(path)

static func _require_key(dict: Dictionary, key: String) -> bool:
	if not dict.has(key):
		push_error("[Blueprint] Missing required key: %s" % key)
		return false
	return true
