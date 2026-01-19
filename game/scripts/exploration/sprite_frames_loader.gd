class_name SpriteFramesLoader
extends RefCounted

const DIRECTIONS := ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
const ANIMATIONS := ["idle", "walk"]


static func build_frames(base_dir: String, sprite_id: String, frame_rate: float = 8.0) -> SpriteFrames:
	if base_dir.is_empty() or sprite_id.is_empty():
		return null

	var frames := SpriteFrames.new()
	var total_frames := 0

	for anim in ANIMATIONS:
		for direction in DIRECTIONS:
			var prefix = "%s_%s_%s" % [sprite_id, anim, direction]
			var files = _collect_files(base_dir, prefix)
			if files.is_empty():
				continue
			var anim_name = "%s_%s" % [anim, direction.to_lower()]
			if not frames.has_animation(anim_name):
				frames.add_animation(anim_name)
				frames.set_animation_speed(anim_name, frame_rate)
				frames.set_animation_loop(anim_name, true)
			for file_name in files:
				var texture_path = "%s/%s" % [base_dir, file_name]
				var texture = _load_texture(texture_path)
				if texture != null:
					frames.add_frame(anim_name, texture)
					total_frames += 1

	if total_frames == 0:
		return null
	return frames


static func _load_texture(texture_path: String) -> Texture2D:
	var image := Image.new()
	var result = image.load(texture_path)
	if result != OK:
		return null
	return ImageTexture.create_from_image(image)


static func _collect_files(base_dir: String, prefix: String) -> Array[String]:
	var dir = DirAccess.open(base_dir)
	if dir == null:
		return []

	var files: Array[String] = []
	dir.list_dir_begin()
	var file_name = dir.get_next()
	while file_name != "":
		if not dir.current_is_dir() and file_name.ends_with(".png") and file_name.begins_with(prefix):
			files.append(file_name)
		file_name = dir.get_next()
	dir.list_dir_end()
	files.sort()
	return files
