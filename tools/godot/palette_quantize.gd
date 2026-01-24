extends Node

const ARG_IN: String = "--in"
const ARG_OUT: String = "--out"
const ARG_PALETTE: String = "--palette"

func _ready() -> void:
	var args: Dictionary = _get_tool_args()
	var input_path: String = String(args.get(ARG_IN, ""))
	var output_path: String = String(args.get(ARG_OUT, ""))
	var palette_path: String = String(args.get(ARG_PALETTE, ""))
	if input_path.is_empty() or output_path.is_empty() or palette_path.is_empty():
		push_error("Missing --in/--out/--palette arguments")
		get_tree().quit(1)
		return

	var palette_colors: Array[Color] = _load_palette(palette_path)
	if palette_colors.is_empty():
		push_error("Palette is empty or invalid: %s" % palette_path)
		get_tree().quit(1)
		return

	var image := Image.new()
	var image_err := image.load(input_path)
	if image_err != OK:
		push_error("Failed to load input image: %s" % input_path)
		get_tree().quit(1)
		return

	_quantize_image(image, palette_colors)
	_make_dir_recursive(output_path.get_base_dir())
	var save_err := image.save_png(output_path)
	if save_err != OK:
		push_error("Failed to save output image: %s" % output_path)
		get_tree().quit(1)
		return

	get_tree().quit(0)

func _get_tool_args() -> Dictionary:
	var raw: PackedStringArray = OS.get_cmdline_args()
	var start: int = raw.find("--")
	if start != -1:
		raw = raw.slice(start + 1)
	var parsed: Dictionary = {}
	var i: int = 0
	while i < raw.size():
		var key: String = raw[i]
		var value: String = ""
		if i + 1 < raw.size():
			value = raw[i + 1]
		parsed[key] = value
		i += 2
	return parsed

func _load_palette(path: String) -> Array[Color]:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return []
	var content: String = file.get_as_text()
	var data: Variant = JSON.parse_string(content)
	var colors: Array[Color] = []
	if typeof(data) == TYPE_DICTIONARY:
		if data.has("colors"):
			var color_dict: Dictionary = data["colors"]
			for key in color_dict.keys():
				var color: Color = _palette_entry_to_color(color_dict[key])
				if color.a >= 0.0:
					colors.append(color)
			return colors
		return []
	if typeof(data) != TYPE_ARRAY:
		return []
	for entry in data:
		var color: Color = _palette_entry_to_color(entry)
		if color.a >= 0.0:
			colors.append(color)
	return colors

func _palette_entry_to_color(entry: Variant) -> Color:
	if typeof(entry) == TYPE_STRING:
		var text: String = String(entry).strip_edges()
		if text.begins_with("#"):
			text = text.substr(1)
		if text.length() == 6:
			return Color.html(text)
	if typeof(entry) == TYPE_ARRAY and entry.size() >= 3:
		return Color(float(entry[0]) / 255.0, float(entry[1]) / 255.0, float(entry[2]) / 255.0, 1.0)
	return Color(0.0, 0.0, 0.0, -1.0)

func _quantize_image(image: Image, palette: Array[Color]) -> void:
	image.lock()
	var width: int = image.get_width()
	var height: int = image.get_height()
	for y in range(height):
		for x in range(width):
			var pixel: Color = image.get_pixel(x, y)
			if pixel.a <= 0.0:
				continue
			var nearest: Color = _nearest_color(pixel, palette)
			image.set_pixel(x, y, Color(nearest.r, nearest.g, nearest.b, pixel.a))
	image.unlock()

func _nearest_color(pixel: Color, palette: Array[Color]) -> Color:
	var best: Color = palette[0]
	var best_distance: float = INF
	for candidate in palette:
		var dr: float = pixel.r - candidate.r
		var dg: float = pixel.g - candidate.g
		var db: float = pixel.b - candidate.b
		var distance: float = dr * dr + dg * dg + db * db
		if distance < best_distance:
			best_distance = distance
			best = candidate
	return best

func _make_dir_recursive(path: String) -> void:
	if path.is_empty():
		return
	DirAccess.make_dir_recursive_absolute(path)
