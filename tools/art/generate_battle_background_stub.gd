extends SceneTree

const WIDTH := 3840
const HEIGHT := 2160
const SKY_TOP := Color(0.62, 0.86, 0.98, 1.0)
const SKY_BOTTOM := Color(0.35, 0.68, 0.92, 1.0)
const MEADOW_TOP := Color(0.38, 0.68, 0.36, 1.0)
const MEADOW_BOTTOM := Color(0.2, 0.45, 0.22, 1.0)
const PATH_COLOR := Color(0.75, 0.64, 0.42, 1.0)

const OUTPUTS := [
	"art/exports/battle_backgrounds/cloverhollow/meadow_stub/bg.png",
	"art/exports/battle_backgrounds/cloverhollow/default/bg.png",
	"game/assets/battle_backgrounds/cloverhollow/meadow_stub/bg.png",
	"game/assets/battle_backgrounds/cloverhollow/default/bg.png",
]

func _initialize() -> void:
	var image = Image.create(WIDTH, HEIGHT, false, Image.FORMAT_RGBA8)
	_draw_background(image)
	for path in OUTPUTS:
		_save_png(image, path)
	quit()


func _draw_background(image: Image) -> void:
	var horizon = int(HEIGHT * 0.55)
	for y in range(HEIGHT):
		var row_color = _row_color(y, horizon)
		for x in range(WIDTH):
			image.set_pixel(x, y, row_color)
	_draw_path(image, horizon)


func _row_color(y: int, horizon: int) -> Color:
	if y < horizon:
		var t = float(y) / float(max(horizon - 1, 1))
		return SKY_TOP.lerp(SKY_BOTTOM, t)
	var t = float(y - horizon) / float(max(HEIGHT - horizon - 1, 1))
	return MEADOW_TOP.lerp(MEADOW_BOTTOM, t)


func _draw_path(image: Image, horizon: int) -> void:
	var path_height = int(HEIGHT * 0.18)
	var start_y = int(HEIGHT * 0.62)
	var end_y = min(start_y + path_height, HEIGHT)
	for y in range(start_y, end_y):
		var t = float(y - start_y) / float(max(path_height - 1, 1))
		var half_width = int(140 + t * 520)
		var center_x = int(WIDTH * 0.5)
		var left = max(center_x - half_width, 0)
		var right = min(center_x + half_width, WIDTH - 1)
		for x in range(left, right):
			image.set_pixel(x, y, PATH_COLOR)


func _save_png(image: Image, path: String) -> void:
	var absolute = ProjectSettings.globalize_path("res://" + path)
	DirAccess.make_dir_recursive_absolute(absolute.get_base_dir())
	image.save_png(absolute)
