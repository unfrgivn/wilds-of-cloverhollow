extends SceneTree

const SCENE_ROOT: String = "res://content/scenes"

func _init() -> void:
	_run()

func _run() -> void:
	_generate_town_square()
	_generate_arcade()
	_generate_school_hall()
	_generate_inn()
	_generate_fae_house()
	print("[PathBGrounds] Generated ground plates")
	quit(0)

func _generate_town_square() -> void:
	var size: Vector2i = Vector2i(1280, 720)
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.62, 0.78, 0.60, 1.0))
	var plaza_rect: Rect2i = Rect2i(300, 240, 680, 240)
	image.fill_rect(plaza_rect, Color(0.74, 0.70, 0.66, 1.0))
	var path_rect: Rect2i = Rect2i(520, 480, 240, 200)
	image.fill_rect(path_rect, Color(0.78, 0.74, 0.70, 1.0))
	var curb_rect: Rect2i = Rect2i(280, 220, 720, 12)
	image.fill_rect(curb_rect, Color(0.70, 0.66, 0.62, 1.0))
	_save_png(image, SCENE_ROOT.path_join("town_square_01").path_join("ground.png"))

	var walkmask: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	walkmask.fill(Color(1, 1, 1, 1))
	_save_png(walkmask, SCENE_ROOT.path_join("town_square_01").path_join("base_walkmask.png"))

func _generate_arcade() -> void:
	var size: Vector2i = Vector2i(1280, 720)
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.80, 0.74, 0.70, 1.0))
	var carpet: Rect2i = Rect2i(220, 200, 840, 320)
	image.fill_rect(carpet, Color(0.72, 0.60, 0.64, 1.0))
	_save_png(image, SCENE_ROOT.path_join("arcade_01").path_join("ground.png"))

func _generate_school_hall() -> void:
	var size: Vector2i = Vector2i(1280, 720)
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.84, 0.80, 0.74, 1.0))
	var hallway: Rect2i = Rect2i(240, 180, 800, 360)
	image.fill_rect(hallway, Color(0.76, 0.72, 0.68, 1.0))
	_save_png(image, SCENE_ROOT.path_join("school_hall_01").path_join("ground.png"))
	_save_png(image, SCENE_ROOT.path_join("school_hall_02").path_join("ground.png"))
	_save_png(image, SCENE_ROOT.path_join("school_hall_03").path_join("ground.png"))

func _generate_inn() -> void:
	var size: Vector2i = Vector2i(1280, 720)
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.86, 0.80, 0.74, 1.0))
	var floor_rect: Rect2i = Rect2i(240, 180, 800, 360)
	image.fill_rect(floor_rect, Color(0.78, 0.70, 0.64, 1.0))
	_save_png(image, SCENE_ROOT.path_join("inn_01").path_join("ground.png"))

func _generate_fae_house() -> void:
	var size: Vector2i = Vector2i(1280, 720)
	var image: Image = Image.create(size.x, size.y, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.88, 0.82, 0.76, 1.0))
	var floor_rect: Rect2i = Rect2i(200, 160, 880, 400)
	image.fill_rect(floor_rect, Color(0.80, 0.74, 0.70, 1.0))
	_save_png(image, SCENE_ROOT.path_join("fae_house_01").path_join("ground.png"))

func _save_png(image: Image, path: String) -> void:
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var error: Error = image.save_png(path)
	if error != OK:
		push_error("[PathBGrounds] Failed to save %s" % path)
