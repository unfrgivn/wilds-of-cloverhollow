extends RefCounted
class_name BattleBackgroundLoader

const BASE_PATH := "res://game/assets/battle_backgrounds"
const DEFAULT_BIOME_ID := "cloverhollow"
const DEFAULT_BACKGROUND_ID := "default"

func load_background(biome_id: String, background_id: String) -> Dictionary:
	var resolved_biome = biome_id.strip_edges()
	if resolved_biome.is_empty():
		resolved_biome = DEFAULT_BIOME_ID
	var resolved_background = background_id.strip_edges()
	if resolved_background.is_empty():
		resolved_background = DEFAULT_BACKGROUND_ID

	var bg_path = _build_path(resolved_biome, resolved_background, "bg.png")
	var fg_path = _build_path(resolved_biome, resolved_background, "fg.png")
	var bg_texture = _load_texture(bg_path)
	var fg_texture = _load_texture(fg_path)
	var used_fallback = false

	if bg_texture == null:
		bg_texture = _fallback_texture(resolved_biome, resolved_background)
		used_fallback = true

	return {
		"bg": bg_texture,
		"fg": fg_texture,
		"bg_path": bg_path,
		"fg_path": fg_path,
		"fallback": used_fallback,
	}


func _build_path(biome_id: String, background_id: String, file_name: String) -> String:
	return BASE_PATH.path_join(biome_id).path_join(background_id).path_join(file_name)


func _load_texture(path: String) -> Texture2D:
	if not ResourceLoader.exists(path):
		return null
	var resource = load(path)
	if resource is Texture2D:
		return resource
	return null


func _fallback_texture(biome_id: String, background_id: String) -> Texture2D:
	var width = 8
	var height = 8
	var image = Image.create(width, height, false, Image.FORMAT_RGBA8)
	var top_color = Color(0.07, 0.1, 0.15, 1.0)
	var bottom_color = Color(0.03, 0.05, 0.08, 1.0)
	for y in range(height):
		var t = float(y) / float(height - 1)
		var row_color = top_color.lerp(bottom_color, t)
		for x in range(width):
			image.set_pixel(x, y, row_color)
	return ImageTexture.create_from_image(image)
