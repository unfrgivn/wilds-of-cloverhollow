extends SceneTree

const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")
const PROP_ROOT: String = "res://content/props"

class PropSpec:
	var id: String
	var base_size: Vector2i
	var overhang_size: Vector2i
	var base_color: Color
	var overhang_color: Color
	var blocks_movement: bool
	var has_overhang: bool
	var footprint_size: Vector2i
	var footprint_rects: Array[Rect2i]
	var default_bake_mode: String
	var category: String

	func _init(
		prop_id: String,
		base_size_px: Vector2i,
		overhang_size_px: Vector2i,
		base: Color,
		overhang: Color,
		blocking: bool,
		overhang_enabled: bool,
		footprint_size_px: Vector2i,
		footprints: Array[Rect2i],
		bake_mode: String,
		category_name: String
	) -> void:
		id = prop_id
		base_size = base_size_px
		overhang_size = overhang_size_px
		base_color = base
		overhang_color = overhang
		blocks_movement = blocking
		has_overhang = overhang_enabled
		footprint_size = footprint_size_px
		footprint_rects = footprints
		default_bake_mode = bake_mode
		category = category_name

func _init() -> void:
	_run()

func _run() -> void:
	var specs: Array[PropSpec] = _build_specs()
	for spec in specs:
		_generate_prop(spec)
	print("[PathBProps] Generated %d props" % specs.size())
	quit(0)

func _build_specs() -> Array[PropSpec]:
	var padding: int = PIPELINE_CONSTANTS.ART_PADDING_PX
	var specs: Array[PropSpec] = []
	var house_base: Vector2i = Vector2i(256, 192)
	var house_overhang: Vector2i = Vector2i(256, 96)
	var house_footprint: Rect2i = Rect2i(padding, 120, house_base.x - padding * 2, 64)

	specs.append(PropSpec.new(
		"house_timber_01",
		house_base,
		house_overhang,
		Color(0.86, 0.78, 0.68, 1.0),
		Color(0.55, 0.45, 0.38, 1.0),
		true,
		true,
		house_base,
		[house_footprint],
		"static",
		"BUILDING"
	))

	specs.append(PropSpec.new(
		"house_timber_02",
		house_base,
		house_overhang,
		Color(0.82, 0.74, 0.66, 1.0),
		Color(0.50, 0.40, 0.34, 1.0),
		true,
		true,
		house_base,
		[house_footprint],
		"static",
		"BUILDING"
	))

	specs.append(PropSpec.new(
		"house_stone_01",
		house_base,
		house_overhang,
		Color(0.75, 0.76, 0.78, 1.0),
		Color(0.45, 0.47, 0.52, 1.0),
		true,
		true,
		house_base,
		[house_footprint],
		"static",
		"BUILDING"
	))

	specs.append(PropSpec.new(
		"house_stone_02",
		house_base,
		house_overhang,
		Color(0.70, 0.72, 0.75, 1.0),
		Color(0.40, 0.42, 0.48, 1.0),
		true,
		true,
		house_base,
		[house_footprint],
		"static",
		"BUILDING"
	))

	specs.append(PropSpec.new(
		"shop_01",
		house_base,
		house_overhang,
		Color(0.80, 0.72, 0.70, 1.0),
		Color(0.70, 0.45, 0.45, 1.0),
		true,
		true,
		house_base,
		[house_footprint],
		"static",
		"BUILDING"
	))

	specs.append(PropSpec.new(
		"school_01_exterior",
		house_base,
		house_overhang,
		Color(0.78, 0.76, 0.70, 1.0),
		Color(0.50, 0.46, 0.40, 1.0),
		true,
		true,
		house_base,
		[house_footprint],
		"static",
		"BUILDING"
	))

	var room_size: Vector2i = Vector2i(960, 540)
	var room_overhang: Vector2i = Vector2i(960, 160)
	var wall_thickness: int = 40
	var room_footprints: Array[Rect2i] = [
		Rect2i(0, 0, room_size.x, 140),
		Rect2i(0, 140, wall_thickness, room_size.y - 140),
		Rect2i(room_size.x - wall_thickness, 140, wall_thickness, room_size.y - 140)
	]

	specs.append(PropSpec.new(
		"room_shell_arcade_01",
		room_size,
		room_overhang,
		Color(0.82, 0.76, 0.70, 1.0),
		Color(0.60, 0.50, 0.46, 1.0),
		true,
		true,
		room_size,
		room_footprints,
		"static",
		"ROOM_SHELL"
	))

	specs.append(PropSpec.new(
		"room_shell_school_01",
		room_size,
		room_overhang,
		Color(0.80, 0.78, 0.74, 1.0),
		Color(0.58, 0.52, 0.48, 1.0),
		true,
		true,
		room_size,
		room_footprints,
		"static",
		"ROOM_SHELL"
	))

	return specs

func _generate_prop(spec: PropSpec) -> void:
	var base_dir: String = PROP_ROOT.path_join(spec.id)
	var visuals_dir: String = base_dir.path_join("visuals")
	var footprints_dir: String = base_dir.path_join("footprints")
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(visuals_dir))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(footprints_dir))

	var base_path: String = visuals_dir.path_join("base.png")
	var overhang_path: String = visuals_dir.path_join("overhang.png")
	var footprint_path: String = footprints_dir.path_join("block.png")

	_save_image(_create_padded_image(spec.base_size, spec.base_color), base_path)
	if spec.has_overhang:
		_save_image(_create_padded_image(spec.overhang_size, spec.overhang_color), overhang_path)

	if spec.blocks_movement:
		var footprint_image: Image = _create_footprint(spec.footprint_size, spec.footprint_rects)
		_save_image(footprint_image, footprint_path)

	var tscn_path: String = base_dir.path_join("%s.tscn" % spec.id)
	_write_scene_file(spec, tscn_path, base_path, overhang_path)
	_write_prop_def_file(spec, base_dir, tscn_path, base_path, overhang_path, footprint_path)

func _create_padded_image(size: Vector2i, color: Color) -> Image:
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	var padding: int = PIPELINE_CONSTANTS.ART_PADDING_PX
	var rect: Rect2i = Rect2i(padding, padding, size.x - padding * 2, size.y - padding * 2)
	if rect.size.x > 0 and rect.size.y > 0:
		image.fill_rect(rect, color)
	return image

func _create_footprint(size: Vector2i, rects: Array[Rect2i]) -> Image:
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0, 0, 0, 0))
	for rect in rects:
		image.fill_rect(rect, Color(1, 1, 1, 1))
	return image

func _write_scene_file(spec: PropSpec, tscn_path: String, base_path: String, overhang_path: String) -> void:
	var lines: Array[String] = []
	var load_steps: int = 3
	if spec.has_overhang:
		load_steps = 4
	lines.append("[gd_scene load_steps=%d format=3]" % load_steps)
	lines.append("")
	lines.append("[ext_resource type=\"Script\" path=\"res://game/props/prop_instance.gd\" id=\"1_instance\"]")
	lines.append("[ext_resource type=\"Texture2D\" path=\"%s\" id=\"2_base\"]" % base_path)
	if spec.has_overhang:
		lines.append("[ext_resource type=\"Texture2D\" path=\"%s\" id=\"3_overhang\"]" % overhang_path)
	lines.append("")
	lines.append("[node name=\"%s\" type=\"Node2D\"]" % _prop_node_name(spec.id))
	lines.append("script = ExtResource(\"1_instance\")")
	lines.append("")
	lines.append("[node name=\"ShadowSprite\" type=\"Sprite2D\" parent=\".\"]")
	lines.append("z_index = -1")
	lines.append("")
	lines.append("[node name=\"BaseSprite\" type=\"Sprite2D\" parent=\".\"]")
	lines.append("texture = ExtResource(\"2_base\")")
	if spec.has_overhang:
		lines.append("")
		lines.append("[node name=\"OverhangSprite\" type=\"Sprite2D\" parent=\".\"]")
		lines.append("texture = ExtResource(\"3_overhang\")")
	lines.append("")
	_write_text_file(tscn_path, "\n".join(lines))

func _write_prop_def_file(spec: PropSpec, base_dir: String, tscn_path: String, base_path: String, overhang_path: String, footprint_path: String) -> void:
	var ext_lines: Array[String] = []
	var resource_lines: Array[String] = []
	var load_steps: int = 3
	var footprint_id: String = ""
	var overhang_id: String = ""
	var base_id: String = "3_base"
	var next_id: int = 4
	if spec.has_overhang:
		overhang_id = "%d_overhang" % next_id
		next_id += 1
	if spec.blocks_movement:
		footprint_id = "%d_footprint" % next_id
		next_id += 1
	load_steps = next_id

	ext_lines.append("[ext_resource type=\"Script\" path=\"res://game/props/prop_def.gd\" id=\"1_def\"]")
	ext_lines.append("[ext_resource type=\"PackedScene\" path=\"%s\" id=\"2_prefab\"]" % tscn_path)
	ext_lines.append("[ext_resource type=\"Texture2D\" path=\"%s\" id=\"%s\"]" % [base_path, base_id])
	if spec.has_overhang:
		ext_lines.append("[ext_resource type=\"Texture2D\" path=\"%s\" id=\"%s\"]" % [overhang_path, overhang_id])
	if spec.blocks_movement:
		ext_lines.append("[ext_resource type=\"Texture2D\" path=\"%s\" id=\"%s\"]" % [footprint_path, footprint_id])

	resource_lines.append("[resource]")
	resource_lines.append("script = ExtResource(\"1_def\")")
	resource_lines.append("id = \"%s\"" % spec.id)
	resource_lines.append("prefab = ExtResource(\"2_prefab\")")
	resource_lines.append("base_textures = [ExtResource(\"%s\")]" % base_id)
	resource_lines.append("blocks_movement = %s" % ("true" if spec.blocks_movement else "false"))
	if spec.blocks_movement:
		resource_lines.append("footprint_mask = ExtResource(\"%s\")" % footprint_id)
		resource_lines.append("footprint_anchor_px = Vector2i(%d, %d)" % [spec.footprint_size.x / 2, spec.footprint_size.y - 1])
	resource_lines.append("has_overhang = %s" % ("true" if spec.has_overhang else "false"))
	if spec.has_overhang:
		resource_lines.append("overhang_textures = [ExtResource(\"%s\")]" % overhang_id)
	resource_lines.append("default_bake_mode = \"%s\"" % spec.default_bake_mode)
	resource_lines.append("category = \"%s\"" % spec.category)
	resource_lines.append("")

	var lines: Array[String] = []
	lines.append("[gd_resource type=\"Resource\" script_class=\"PropDef\" load_steps=%d format=3]" % load_steps)
	lines.append("")
	lines.append_array(ext_lines)
	lines.append("")
	lines.append_array(resource_lines)
	var def_path: String = base_dir.path_join("%s_def.tres" % spec.id)
	_write_text_file(def_path, "\n".join(lines))

func _write_text_file(path: String, content: String) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		push_error("[PathBProps] Failed to write %s" % path)
		return
	file.store_string(content)
	file.close()

func _prop_node_name(prop_id: String) -> String:
	var parts: PackedStringArray = prop_id.split("_")
	var name: String = ""
	for part in parts:
		name += part.capitalize()
	return name

func _save_image(image: Image, path: String) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	var error: Error = image.save_png(path)
	if error != OK:
		push_error("[PathBProps] Failed to save %s (%s)" % [path, error])
