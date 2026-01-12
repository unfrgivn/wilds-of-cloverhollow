extends SceneTree

const PROP_SIZE: Vector2i = Vector2i(64, 64)
const FOOTPRINT_SIZE: Vector2i = Vector2i(64, 64)
const DECAL_SIZE: Vector2i = Vector2i(16, 16)


func _init() -> void:
	_generate_prop("tree_01", Color(0.25, 0.55, 0.25, 1.0), true, Color(0.20, 0.35, 0.20, 0.85))
	_generate_prop("bench_01", Color(0.55, 0.35, 0.20, 1.0), false, Color(0.45, 0.30, 0.15, 0.85))
	_generate_prop("crate_01", Color(0.65, 0.45, 0.25, 1.0), false, Color(0.50, 0.35, 0.20, 0.85))
	_generate_prop("lamp_01", Color(0.85, 0.85, 0.55, 1.0), true, Color(0.75, 0.70, 0.30, 0.85))
	_generate_prop("fence_01", Color(0.40, 0.40, 0.45, 1.0), false, Color(0.35, 0.35, 0.40, 0.85))
	_generate_decals()
	print("[PropPlaceholders] Generated prop placeholder visuals and footprints.")
	quit(0)

func _generate_prop(prop_id: String, base_color: Color, has_overhang: bool, overhang_color: Color) -> void:
	var base_path: String = "res://content/props/%s/visuals/base.png" % prop_id
	var footprint_path: String = "res://content/props/%s/footprints/block.png" % prop_id
	var base_image: Image = Image.create(PROP_SIZE.x, PROP_SIZE.y, false, Image.FORMAT_RGBA8)
	base_image.fill(base_color)
	_save_image(base_image, base_path)

	var base_variant_color: Color = _base_variant_color(prop_id, base_color)
	if base_variant_color != base_color:
		var base_variant_path: String = "res://content/props/%s/visuals/base_variant_1.png" % prop_id
		var base_variant: Image = Image.create(PROP_SIZE.x, PROP_SIZE.y, false, Image.FORMAT_RGBA8)
		base_variant.fill(base_variant_color)
		_save_image(base_variant, base_variant_path)

	if has_overhang:
		var overhang_path: String = "res://content/props/%s/visuals/overhang.png" % prop_id
		var overhang_image: Image = _create_overhang_image(prop_id, overhang_color)
		_save_image(overhang_image, overhang_path)
		var overhang_variant_path: String = "res://content/props/%s/visuals/overhang_variant_1.png" % prop_id
		var overhang_variant: Image = _create_overhang_variant_image(prop_id, overhang_color)
		_save_image(overhang_variant, overhang_variant_path)

	var footprint: Image = Image.create(FOOTPRINT_SIZE.x, FOOTPRINT_SIZE.y, false, Image.FORMAT_RGBA8)
	footprint.fill(Color(0, 0, 0, 0))
	_draw_footprint_block(footprint)
	_save_image(footprint, footprint_path)

func _create_overhang_image(prop_id: String, overhang_color: Color) -> Image:
	if prop_id == "tree_01":
		var image: Image = Image.create(96, 96, false, Image.FORMAT_RGBA8)
		_draw_tree_overhang(image)
		return image
	if prop_id == "lamp_01":
		var image: Image = Image.create(24, 32, false, Image.FORMAT_RGBA8)
		_draw_lamp_overhang(image)
		return image
	var image: Image = Image.create(PROP_SIZE.x, PROP_SIZE.y / 2, false, Image.FORMAT_RGBA8)
	image.fill(overhang_color)
	return image

func _create_overhang_variant_image(prop_id: String, overhang_color: Color) -> Image:
	if prop_id == "tree_01":
		var image: Image = Image.create(96, 96, false, Image.FORMAT_RGBA8)
		image.fill(Color8(0xFF, 0x8A, 0x65, 255))
		image.fill_rect(Rect2i(8, 8, 80, 80), Color8(0xF4, 0x8F, 0xB1, 217))
		image.fill_rect(Rect2i(24, 24, 48, 48), Color8(0xFF, 0xCC, 0x80, 230))
		return image
	if prop_id == "lamp_01":
		var image: Image = Image.create(24, 32, false, Image.FORMAT_RGBA8)
		image.fill(Color8(0x2D, 0x2D, 0x2D, 255))
		image.fill_rect(Rect2i(4, 4, 16, 24), Color8(0xFF, 0xF1, 0x76, 242))
		image.fill_rect(Rect2i(8, 8, 8, 16), Color8(0xFF, 0xFA, 0xCD, 255))
		return image
	var image: Image = Image.create(PROP_SIZE.x, PROP_SIZE.y / 2, false, Image.FORMAT_RGBA8)
	image.fill(overhang_color)
	return image

func _base_variant_color(prop_id: String, base_color: Color) -> Color:
	match prop_id:
		"tree_01":
			return Color8(0x8D, 0x6E, 0x63, 255)
		"bench_01":
			return Color8(0xC8, 0xE6, 0xC9, 255)
		"crate_01":
			return Color8(0xD7, 0xCC, 0xC8, 255)
		"lamp_01":
			return Color8(0x37, 0x47, 0x4F, 255)
		"fence_01":
			return Color8(0x55, 0x60, 0x70, 255)
		_:
			return base_color

func _draw_tree_overhang(image: Image) -> void:
	image.fill(Color8(0x1E, 0x3F, 0x32, 255))
	image.fill_rect(Rect2i(8, 8, 80, 80), Color8(0x2E, 0x8B, 0x57, 217))
	image.fill_rect(Rect2i(24, 24, 48, 48), Color8(0x3C, 0xB3, 0x71, 230))

func _draw_lamp_overhang(image: Image) -> void:
	image.fill(Color8(0x2D, 0x2D, 0x2D, 255))
	image.fill_rect(Rect2i(4, 4, 16, 24), Color8(0xFF, 0xD7, 0x00, 242))
	image.fill_rect(Rect2i(8, 8, 8, 16), Color8(0xFF, 0xFA, 0xCD, 255))

func _draw_footprint_block(footprint: Image) -> void:
	var width: int = FOOTPRINT_SIZE.x
	var height: int = FOOTPRINT_SIZE.y
	var block_rect: Rect2i = Rect2i(0, 0, width, height)
	for x in range(block_rect.position.x, block_rect.position.x + block_rect.size.x):
		for y in range(block_rect.position.y, block_rect.position.y + block_rect.size.y):
			footprint.set_pixel(x, y, Color(1, 1, 1, 1))

func _generate_decals() -> void:
	var decals_root: String = "res://content/decals"
	DirAccess.make_dir_recursive_absolute(decals_root)

	var scuff: Image = Image.create(DECAL_SIZE.x, DECAL_SIZE.y, false, Image.FORMAT_RGBA8)
	scuff.fill(Color(0, 0, 0, 0))
	scuff.fill_rect(Rect2i(2, 10, 10, 3), Color8(0x8D, 0x6E, 0x63, 140))
	scuff.fill_rect(Rect2i(4, 7, 6, 2), Color8(0x8D, 0x6E, 0x63, 110))
	_save_image(scuff, decals_root.path_join("scuff_01.png"))

	var leaf: Image = Image.create(DECAL_SIZE.x, DECAL_SIZE.y, false, Image.FORMAT_RGBA8)
	leaf.fill(Color(0, 0, 0, 0))
	leaf.fill_rect(Rect2i(6, 6, 3, 3), Color8(0xFF, 0xAB, 0x91, 230))
	leaf.fill_rect(Rect2i(9, 8, 2, 2), Color8(0xFF, 0xCC, 0x80, 230))
	_save_image(leaf, decals_root.path_join("leaf_01.png"))

	var sparkle: Image = Image.create(DECAL_SIZE.x, DECAL_SIZE.y, false, Image.FORMAT_RGBA8)
	sparkle.fill(Color(0, 0, 0, 0))
	sparkle.fill_rect(Rect2i(8, 4, 1, 8), Color8(0xFF, 0xF5, 0x9D, 204))
	sparkle.fill_rect(Rect2i(4, 8, 8, 1), Color8(0xFF, 0xF5, 0x9D, 204))
	sparkle.fill_rect(Rect2i(7, 7, 2, 2), Color8(0xE1, 0xF5, 0xFE, 220))
	_save_image(sparkle, decals_root.path_join("sparkle_01.png"))

func _save_image(image: Image, path: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var error: Error = image.save_png(path)
	if error != OK:
		push_error("[PropPlaceholders] Failed to save %s (%s)" % [path, error])
