extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")
const PROP_DEF_SCRIPT: Script = preload("res://game/props/prop_def.gd")

const DEBUG_FLAG: String = "--debug"

var _had_errors: bool = false

func _init() -> void:
	var args: PackedStringArray = OS.get_cmdline_args()
	var debug_output: bool = args.has(DEBUG_FLAG)
	var scene_paths: Array[String] = _find_scene_json_paths()
	for scene_path in scene_paths:
		_bake_scene(scene_path, debug_output)
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

func _bake_scene(scene_path: String, debug_output: bool) -> void:
	var data: Dictionary = _load_scene_json(scene_path)
	if data.is_empty():
		return
	if not data.has("assets") or typeof(data["assets"]) != TYPE_DICTIONARY:
		_push_error("Missing assets", scene_path)
		return
	var assets: Dictionary = data["assets"]
	if not assets.has("ground") or not assets.has("plate_base") or not assets.has("plate_overhang"):
		_push_error("Missing plate asset paths", scene_path)
		return
	if not data.has("size_px") or typeof(data["size_px"]) != TYPE_ARRAY:
		_push_error("Missing size_px", scene_path)
		return
	var size_arr: Array = data["size_px"]
	if size_arr.size() != 2:
		_push_error("Invalid size_px", scene_path)
		return
	var size: Vector2i = Vector2i(int(size_arr[0]), int(size_arr[1]))
	if size.x <= 0 or size.y <= 0:
		_push_error("Invalid size dimensions", scene_path)
		return
	var ground_path: String = str(assets["ground"]).strip_edges()
	var ground_image: Image = _load_image_from_path(ground_path, scene_path, "ground")
	if ground_image == null:
		return
	if ground_image.get_size() != size:
		_push_error("ground size mismatch", scene_path)
		return
	var base_plate: Image = ground_image.duplicate()
	if base_plate.get_format() != Image.FORMAT_RGBA8:
		base_plate.convert(Image.FORMAT_RGBA8)
	var overhang_plate: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	overhang_plate.fill(Color(0, 0, 0, 0))

	if not data.has("props") or typeof(data["props"]) != TYPE_ARRAY:
		_push_error("Missing props array", scene_path)
		return
	var prop_entries: Array = data["props"]
	var shadows: Array[Dictionary] = []
	var bases: Array[Dictionary] = []
	var overhangs: Array[Dictionary] = []
	for entry in prop_entries:
		if typeof(entry) != TYPE_DICTIONARY:
			_push_error("Invalid prop entry", scene_path)
			return
		var prop_data: Dictionary = entry
		var bake_mode: String = str(prop_data.get("bake", "static")).strip_edges().to_lower()
		if bake_mode != "static":
			continue
		var def_path: String = str(prop_data.get("def", "")).strip_edges()
		if def_path == "":
			_push_error("Prop def empty", scene_path)
			return
		var prop_def: PropDef = _load_prop_def(def_path)
		if prop_def == null:
			_push_error("Failed to load PropDef: %s" % def_path, scene_path)
			return
		var pos_arr: Array = prop_data.get("pos", [])
		if pos_arr.size() != 2:
			_push_error("Invalid prop pos", scene_path)
			return
		var prop_pos: Vector2i = Vector2i(int(pos_arr[0]), int(pos_arr[1]))
		var variant: int = int(prop_data.get("variant", 0))
		_collect_prop_layers(prop_def, prop_pos, variant, shadows, bases, overhangs)

	shadows.sort_custom(_sort_layer)
	bases.sort_custom(_sort_layer)
	overhangs.sort_custom(_sort_layer)

	for layer in shadows:
		_blend_layer(base_plate, layer)
	for layer in bases:
		_blend_layer(base_plate, layer)
	for layer in overhangs:
		_blend_layer(overhang_plate, layer)

	var plate_base_path: String = str(assets["plate_base"])
	var plate_overhang_path: String = str(assets["plate_overhang"])
	DirAccess.make_dir_recursive_absolute(plate_base_path.get_base_dir())
	if base_plate.save_png(plate_base_path) != OK:
		_push_error("Failed to save plate_base", scene_path)
		return
	if overhang_plate.save_png(plate_overhang_path) != OK:
		_push_error("Failed to save plate_overhang", scene_path)
		return
	if debug_output:
		_save_debug_plate(scene_path, base_plate, shadows, bases, overhangs)
	print("[BakePlates] %s" % scene_path)

func _collect_prop_layers(prop_def: PropDef, prop_pos: Vector2i, variant: int, shadows: Array[Dictionary], bases: Array[Dictionary], overhangs: Array[Dictionary]) -> void:
	var base_texture: Texture2D = _resolve_variant_texture(prop_def.base_textures, variant)
	if base_texture != null:
		var base_image: Image = _load_texture_image(base_texture)
		if base_image != null:
			var offset: Vector2i = _bottom_center_offset(base_image.get_size())
			bases.append(_layer_entry(base_image, prop_pos, offset))
	var shadow_entry: Dictionary = _resolve_shadow_entry(prop_def)
	if not shadow_entry.is_empty():
		var shadow_texture: Texture2D = shadow_entry["texture"]
		var shadow_extra: Vector2i = shadow_entry["offset"]
		var shadow_image: Image = _load_texture_image(shadow_texture)
		if shadow_image != null:
			var shadow_offset: Vector2i = _shadow_offset(prop_def, shadow_image, shadow_extra)
			shadows.append(_layer_entry(shadow_image, prop_pos, shadow_offset))
	if prop_def.has_overhang:
		var overhang_texture: Texture2D = _resolve_variant_texture(prop_def.overhang_textures, variant)
		if overhang_texture != null:
			var overhang_image: Image = _load_texture_image(overhang_texture)
			if overhang_image != null:
				var overhang_offset: Vector2i = _bottom_center_offset(overhang_image.get_size())
				overhangs.append(_layer_entry(overhang_image, prop_pos, overhang_offset))

func _resolve_variant_texture(textures: Array[Texture2D], variant: int) -> Texture2D:
	if textures.is_empty():
		return null
	var index: int = clamp(variant, 0, textures.size() - 1)
	return textures[index]

func _resolve_shadow_entry(prop_def: PropDef) -> Dictionary:
	if prop_def.resource_path == "":
		return {}
	var base_dir: String = prop_def.resource_path.get_base_dir()
	var authored_path: String = base_dir.path_join("visuals/shadow.png")
	if ResourceLoader.exists(authored_path, "Texture2D"):
		return {
			"texture": ResourceLoader.load(authored_path) as Texture2D,
			"offset": PIPELINE_CONSTANTS.SHADOW_OFFSET_PX
		}
	if FileAccess.file_exists(authored_path):
		var authored_texture: Texture2D = _load_texture_from_file(authored_path)
		if authored_texture != null:
			return {
				"texture": authored_texture,
				"offset": PIPELINE_CONSTANTS.SHADOW_OFFSET_PX
			}
	var generated_path: String = base_dir.path_join("_generated/shadow.png")
	if FileAccess.file_exists(generated_path):
		var generated_texture: Texture2D = _load_texture_from_file(generated_path)
		if generated_texture != null:
			return {
				"texture": generated_texture,
				"offset": Vector2i.ZERO
			}
	return {}

func _shadow_offset(prop_def: PropDef, shadow_image: Image, extra_offset: Vector2i) -> Vector2i:
	var size: Vector2i = shadow_image.get_size()
	if prop_def.footprint_mask != null:
		var footprint_size: Vector2i = Vector2i(prop_def.footprint_mask.get_size())
		if footprint_size == size and prop_def.footprint_anchor_px != Vector2i.ZERO:
			return Vector2i(-prop_def.footprint_anchor_px.x, -prop_def.footprint_anchor_px.y) + extra_offset
	return _bottom_center_offset(size) + extra_offset

func _bottom_center_offset(size: Vector2i) -> Vector2i:
	return Vector2i(-size.x / 2, -size.y)

func _layer_entry(image: Image, prop_pos: Vector2i, offset: Vector2i) -> Dictionary:
	return {
		"image": image,
		"pos": prop_pos,
		"offset": offset,
		"sort_y": prop_pos.y,
		"sort_x": prop_pos.x
	}

func _blend_layer(target: Image, layer: Dictionary) -> void:
	var image: Image = layer["image"]
	if image.get_format() != Image.FORMAT_RGBA8:
		image.convert(Image.FORMAT_RGBA8)
	var pos: Vector2i = layer["pos"]
	var offset: Vector2i = layer["offset"]
	var origin: Vector2i = pos + offset
	var rect: Rect2i = Rect2i(Vector2i.ZERO, image.get_size())
	target.blend_rect(image, rect, origin)

func _sort_layer(a: Dictionary, b: Dictionary) -> bool:
	if int(a["sort_y"]) == int(b["sort_y"]):
		return int(a["sort_x"]) < int(b["sort_x"])
	return int(a["sort_y"]) < int(b["sort_y"])

func _load_texture_image(texture: Texture2D) -> Image:
	if texture == null:
		return null
	var image: Image = texture.get_image()
	if image != null and not image.is_empty():
		return image
	var path: String = texture.resource_path
	if path == "":
		return null
	var fallback: Image = Image.load_from_file(path)
	if fallback == null or fallback.is_empty():
		return null
	return fallback

func _load_texture_from_file(path: String) -> Texture2D:
	var image: Image = Image.load_from_file(path)
	if image == null or image.is_empty():
		return null
	return ImageTexture.create_from_image(image)

func _load_image_from_path(path: String, scene_path: String, label: String) -> Image:
	var texture: Texture2D = ResourceLoader.load(path) as Texture2D
	if texture != null:
		var tex_image: Image = texture.get_image()
		if tex_image != null and not tex_image.is_empty():
			return tex_image
	var fallback: Image = Image.load_from_file(path)
	if fallback == null or fallback.is_empty():
		_push_error("Failed to load %s: %s" % [label, path], scene_path)
		return null
	return fallback

func _save_debug_plate(scene_path: String, base_plate: Image, shadows: Array[Dictionary], bases: Array[Dictionary], overhangs: Array[Dictionary]) -> void:
	var debug_image: Image = base_plate.duplicate()
	if debug_image.get_format() != Image.FORMAT_RGBA8:
		debug_image.convert(Image.FORMAT_RGBA8)
	_draw_debug_points(debug_image, shadows, Color(0.2, 0.8, 1.0, 0.8))
	_draw_debug_points(debug_image, bases, Color(0.4, 1.0, 0.4, 0.8))
	_draw_debug_points(debug_image, overhangs, Color(1.0, 0.6, 0.2, 0.8))
	var debug_path: String = scene_path.get_base_dir().path_join("_baked").path_join("plate_debug_bounds.png")
	DirAccess.make_dir_recursive_absolute(debug_path.get_base_dir())
	if debug_image.save_png(debug_path) != OK:
		_push_error("Failed to save plate_debug_bounds", scene_path)
		return

func _draw_debug_points(image: Image, layers: Array[Dictionary], color: Color) -> void:
	for layer in layers:
		var pos: Vector2i = layer["pos"]
		if pos.x < 0 or pos.y < 0 or pos.x >= image.get_width() or pos.y >= image.get_height():
			continue
		image.set_pixel(pos.x, pos.y, color)

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

func _load_prop_def(def_path: String) -> PropDef:
	var resource: Resource = ResourceLoader.load(def_path)
	if resource == null or resource.get_script() != PROP_DEF_SCRIPT:
		return null
	return resource as PropDef

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
	push_error("[BakePlates] %s (%s)" % [message, scene_path])
