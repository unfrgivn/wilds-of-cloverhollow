extends SceneTree

const PROPS_ROOT: String = "res://content/props"
const MANIFEST_SUFFIX: String = "_manifest.json"

const PROP_INSTANCE_SCRIPT: Script = preload("res://game/props/prop_instance.gd")
const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")

var _had_errors: bool = false
var _created_defs: int = 0
var _updated_defs: int = 0
var _created_prefabs: int = 0
var _updated_prefabs: int = 0

func _init() -> void:
	_run()

func _run() -> void:
	var manifest_paths: Array[String] = _find_manifest_paths(PROPS_ROOT)
	manifest_paths.sort()
	if manifest_paths.is_empty():
		print("[PropManifest] No manifests found")
		quit(0)
		return
	for manifest_path in manifest_paths:
		_process_manifest(manifest_path)
	print("[PropManifest] Defs created: %d updated: %d" % [_created_defs, _updated_defs])
	print("[PropManifest] Prefabs created: %d updated: %d" % [_created_prefabs, _updated_prefabs])
	quit(1 if _had_errors else 0)

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

func _process_manifest(manifest_path: String) -> void:
	var data: Dictionary = _load_manifest(manifest_path)
	if data.is_empty():
		return
	var asset_id: String = str(data.get("asset_id", "")).strip_edges()
	if asset_id == "":
		_push_error("Manifest missing asset_id", manifest_path)
		return
	var outputs: Dictionary = data.get("outputs", {})
	var base_rel: String = str(outputs.get("base_png", "")).strip_edges()
	if base_rel == "":
		_push_error("Manifest missing base_png", manifest_path)
		return
	var footprint_rel: String = str(outputs.get("footprint_png", "")).strip_edges()
	if footprint_rel == "":
		_push_error("Manifest missing footprint_png", manifest_path)
		return
	var overhang_rel: String = ""
	if outputs.has("overhang_png") and outputs["overhang_png"] != null:
		overhang_rel = str(outputs.get("overhang_png", "")).strip_edges()
	var base_dir: String = manifest_path.get_base_dir()
	var base_path: String = base_dir.path_join(base_rel)
	var overhang_path: String = ""
	if overhang_rel != "":
		overhang_path = base_dir.path_join(overhang_rel)
	var footprint_path: String = base_dir.path_join(footprint_rel)

	var defaults: Dictionary = data.get("defaults", {})
	var blocks_movement: bool = bool(defaults.get("blocks_movement", false))
	var has_overhang: bool = bool(defaults.get("has_overhang", false))
	var default_bake_mode: String = str(defaults.get("default_bake_mode", "static")).strip_edges().to_lower()
	if default_bake_mode != "static" and default_bake_mode != "live":
		default_bake_mode = "static"

	var footprint_texture: Texture2D = null
	var footprint_image: Image = null
	if FileAccess.file_exists(footprint_path):
		footprint_texture = _load_texture(footprint_path)
		if footprint_texture != null:
			footprint_image = _load_texture_image(footprint_texture)
		if footprint_image != null and not footprint_image.is_empty():
			if _count_opaque_pixels(footprint_image, PIPELINE_CONSTANTS.ALPHA_THRESHOLD) > 0:
				blocks_movement = true
		else:
			blocks_movement = false
	else:
		blocks_movement = false

	if overhang_path != "" and FileAccess.file_exists(overhang_path):
		has_overhang = true

	var resolved_base_path: String = _prefer_processed_path(base_dir, "base.png", base_path)
	var resolved_overhang_path: String = ""
	if has_overhang and overhang_path != "":
		resolved_overhang_path = _prefer_processed_path(base_dir, "overhang.png", overhang_path)

	var base_texture: Texture2D = _load_texture(resolved_base_path)
	if base_texture == null:
		_push_error("Failed to load base texture", resolved_base_path)
		return
	var overhang_texture: Texture2D = null
	if has_overhang and resolved_overhang_path != "":
		overhang_texture = _load_texture(resolved_overhang_path)
	if has_overhang and overhang_texture == null:
		_push_warning("Overhang texture missing", resolved_overhang_path)

	var footprint_anchor: Vector2i = Vector2i.ZERO
	if blocks_movement:
		if footprint_texture == null:
			_push_error("Blocking prop missing footprint texture", footprint_path)
			return
		if footprint_image == null:
			_push_error("Footprint image failed to load", footprint_path)
			return
		footprint_anchor = Vector2i(footprint_image.get_width() / 2, footprint_image.get_height() - 1)
	else:
		footprint_texture = null

	var def_path: String = base_dir.path_join("%s_def.tres" % asset_id)
	var prefab_path: String = base_dir.path_join("%s.tscn" % asset_id)

	var prop_def: PropDef = PropDef.new()
	prop_def.id = asset_id
	prop_def.prefab = null
	prop_def.base_textures = [base_texture]
	prop_def.overhang_textures = []
	if has_overhang and overhang_texture != null:
		prop_def.overhang_textures = [overhang_texture]
	prop_def.blocks_movement = blocks_movement
	prop_def.footprint_mask = footprint_texture
	prop_def.footprint_anchor_px = footprint_anchor
	prop_def.has_overhang = has_overhang
	prop_def.default_bake_mode = default_bake_mode

	var def_exists: bool = FileAccess.file_exists(def_path)
	if ResourceSaver.save(prop_def, def_path) != OK:
		_push_error("Failed to save PropDef", def_path)
		return
	if def_exists:
		_updated_defs += 1
	else:
		_created_defs += 1

	var saved_def: PropDef = ResourceLoader.load(def_path) as PropDef
	if saved_def == null:
		_push_error("Failed to reload PropDef", def_path)
		return
	var prefab_exists: bool = FileAccess.file_exists(prefab_path)
	var prefab: PackedScene = _build_prefab(asset_id, saved_def, base_texture, overhang_texture, base_dir)
	if prefab == null:
		return
	if ResourceSaver.save(prefab, prefab_path) != OK:
		_push_error("Failed to save prefab", prefab_path)
		return
	if prefab_exists:
		_updated_prefabs += 1
	else:
		_created_prefabs += 1

	var saved_prefab: PackedScene = ResourceLoader.load(prefab_path) as PackedScene
	if saved_prefab == null:
		_push_error("Failed to reload prefab", prefab_path)
		return
	saved_def.prefab = saved_prefab
	if ResourceSaver.save(saved_def, def_path) != OK:
		_push_error("Failed to update PropDef prefab", def_path)

	print("[PropManifest] %s" % asset_id)

func _build_prefab(asset_id: String, prop_def: PropDef, base_texture: Texture2D, overhang_texture: Texture2D, base_dir: String) -> PackedScene:
	var root: Node2D = Node2D.new()
	root.name = asset_id
	root.set_script(PROP_INSTANCE_SCRIPT)

	var shadow_sprite: Sprite2D = Sprite2D.new()
	shadow_sprite.name = "ShadowSprite"
	shadow_sprite.centered = false
	shadow_sprite.texture = _resolve_shadow_texture(base_dir)
	root.add_child(shadow_sprite)

	var base_sprite: Sprite2D = Sprite2D.new()
	base_sprite.name = "BaseSprite"
	base_sprite.centered = false
	base_sprite.texture = base_texture
	root.add_child(base_sprite)

	if prop_def.has_overhang:
		var overhang_sprite: Sprite2D = Sprite2D.new()
		overhang_sprite.name = "OverhangSprite"
		overhang_sprite.centered = false
		overhang_sprite.texture = overhang_texture
		root.add_child(overhang_sprite)

	for child in root.get_children():
		if child is Node:
			(child as Node).owner = root

	var packed: PackedScene = PackedScene.new()
	var pack_result: int = packed.pack(root)
	root.free()
	if pack_result != OK:
		_push_error("Failed to pack prefab", asset_id)
		return null
	return packed

func _resolve_shadow_texture(base_dir: String) -> Texture2D:
	var authored_path: String = base_dir.path_join("visuals/shadow.png")
	if FileAccess.file_exists(authored_path):
		return _load_texture(authored_path)
	var generated_path: String = base_dir.path_join("_generated/shadow.png")
	if FileAccess.file_exists(generated_path):
		var embedded: Texture2D = _load_embedded_texture(generated_path)
		if embedded != null:
			return embedded
		return _load_texture(generated_path)
	return null

func _prefer_processed_path(base_dir: String, file_name: String, fallback: String) -> String:
	var processed: String = base_dir.path_join("visuals").path_join("_processed").path_join(file_name)
	if FileAccess.file_exists(processed):
		return processed
	return fallback

func _load_embedded_texture(path: String) -> Texture2D:
	if not FileAccess.file_exists(path):
		return null
	var absolute_path: String = ProjectSettings.globalize_path(path)
	var image: Image = Image.load_from_file(absolute_path)
	if image == null or image.is_empty():
		return null
	return ImageTexture.create_from_image(image)

func _load_texture(path: String) -> Texture2D:
	if path == "":
		return null
	if ResourceLoader.exists(path, "Texture2D"):
		var resource: Resource = ResourceLoader.load(path)
		if resource is Texture2D:
			return resource as Texture2D
	if path.get_extension().to_lower() == "png" and FileAccess.file_exists(path):
		var absolute_path: String = ProjectSettings.globalize_path(path)
		var image: Image = Image.load_from_file(absolute_path)
		if image != null and not image.is_empty():
			var texture: ImageTexture = ImageTexture.create_from_image(image)
			texture.resource_path = path
			return texture
		return null
	return null

func _load_texture_image(texture: Texture2D) -> Image:
	if texture == null:
		return null
	var image: Image = texture.get_image()
	if image != null and not image.is_empty():
		return image
	var path: String = texture.resource_path
	if path == "":
		return null
	var absolute_path: String = ProjectSettings.globalize_path(path)
	return Image.load_from_file(absolute_path)

func _count_opaque_pixels(image: Image, threshold: float) -> int:
	var count: int = 0
	var width: int = image.get_width()
	var height: int = image.get_height()
	for y in range(height):
		for x in range(width):
			if image.get_pixel(x, y).a > threshold:
				count += 1
	return count

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

func _push_error(message: String, detail: String) -> void:
	_had_errors = true
	push_error("[PropManifest] %s (%s)" % [message, detail])

func _push_warning(message: String, detail: String) -> void:
	push_warning("[PropManifest] %s (%s)" % [message, detail])
