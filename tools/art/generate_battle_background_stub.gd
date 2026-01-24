extends SceneTree

const WIDTH := 960
const HEIGHT := 540
const SKY_COLOR := Color(0.62, 0.86, 0.98, 1.0)
const MEADOW_COLOR := Color(0.38, 0.68, 0.36, 1.0)
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
	var horizon = int(HEIGHT * 0.58)
	image.fill(SKY_COLOR)
	image.fill_rect(Rect2i(0, horizon, WIDTH, HEIGHT - horizon), MEADOW_COLOR)
	_draw_path(image, horizon)


func _draw_path(image: Image, horizon: int) -> void:
	var path_height = HEIGHT - horizon
	for y in range(horizon, HEIGHT):
		var t = float(y - horizon) / float(max(path_height - 1, 1))
		var half_width = int(40 + t * 180)
		var center_x = int(WIDTH * 0.5)
		var left = max(center_x - half_width, 0)
		var right = min(center_x + half_width, WIDTH - 1)
		for x in range(left, right):
			image.set_pixel(x, y, PATH_COLOR)


func _save_png(image: Image, path: String) -> void:
	var absolute = ProjectSettings.globalize_path("res://" + path)
	DirAccess.make_dir_recursive_absolute(absolute.get_base_dir())
	image.save_png(absolute)
