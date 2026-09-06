extends Node3D

## Bounded M229 study scene. This is intentionally isolated from the 2D game
## player, router, save system, and quest state.

const PLAYER_SPEED := 3.8
const JUMP_SPEED := 5.5
const GRAVITY := 15.0

var fae: CharacterBody3D
var camera: Camera3D
var ortho_camera := true
var key_light: DirectionalLight3D
var hud: Label
var _jump_requested := false
var _light_enabled := true
var _capture_note := ""
var _fae_sprite: Sprite3D
var _ground_shadow: MeshInstance3D
var _shadow_ray: RayCast3D
var _facing := "south"
var _walk_clock := 0.0
var _assets_ready := true

var _green := Color("#6f9d5d")
var _grass := Color("#8caf68")
var _dark_grass := Color("#476b50")
var _water := Color("#4c91a2")
var _sand := Color("#d2ba78")
var _wood := Color("#8b593e")
var _stone := Color("#87918b")

func _ready() -> void:
	_build_world()
	_build_fae()
	_build_camera()
	_build_lighting()
	_build_hud()

func _physics_process(delta: float) -> void:
	if fae == null:
		return
	var input := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var world_input := _camera_relative_motion(input)
	fae.velocity.x = world_input.x * PLAYER_SPEED
	fae.velocity.z = world_input.z * PLAYER_SPEED
	if input.length() > 0.05:
		_walk_clock += delta
		_update_fae_facing(input)
		_set_fae_texture(_facing, true)
	else:
		_walk_clock = 0.0
		_set_fae_texture(_facing, false)
	if _jump_requested and fae.is_on_floor():
		fae.velocity.y = JUMP_SPEED
	_jump_requested = false
	if fae.velocity.y > 0.0 or not fae.is_on_floor():
		fae.velocity.y -= GRAVITY * delta
	else:
		fae.velocity.y = min(fae.velocity.y, 0.0)
	fae.move_and_slide()
	_update_shadow()
	_update_hud(input)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_J:
		_jump_requested = true
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_1:
			_set_projection(true)
		elif event.keycode == KEY_2:
			_set_projection(false)
		elif event.keycode == KEY_L:
			_light_enabled = not _light_enabled
			key_light.visible = _light_enabled

func _build_world() -> void:
	# Two raised, layered banks leave a real water channel between them.
	_add_box("WestBank", Vector3(-5.5, -0.35, 0), Vector3(8, 0.7, 14), _green, true)
	_add_box("EastBank", Vector3(5.5, -0.35, 0), Vector3(8, 0.7, 14), _grass, true)
	_add_box("WestStrata", Vector3(-5.5, -0.02, -6.1), Vector3(9, 0.18, 1.1), _dark_grass, false)
	_add_box("EastStrata", Vector3(5.5, -0.02, 6.1), Vector3(9, 0.18, 1.1), _dark_grass, false)
	_add_box("Stream", Vector3(0, -0.48, 0), Vector3(3, 0.08, 14), _water, false)
	# Continuous banks leave only the two-metre bridge approach open.
	for z in [-4.0, 4.0]:
		_add_box("WaterBarrierWest", Vector3(-1.5, -0.05, z), Vector3(0.18, 1.0, 6.0), _sand, true)
		_add_box("WaterBarrierEast", Vector3(1.5, -0.05, z), Vector3(0.18, 1.0, 6.0), _sand, true)
	_add_box("OuterBoundWest", Vector3(-9.5, 1.0, 0), Vector3(0.1, 2.0, 14), Color(0, 0, 0, 0), true, true)
	_add_box("OuterBoundEast", Vector3(9.5, 1.0, 0), Vector3(0.1, 2.0, 14), Color(0, 0, 0, 0), true, true)
	_add_box("OuterBoundNorth", Vector3(0, 1.0, -7), Vector3(19, 2.0, 0.1), Color(0, 0, 0, 0), true, true)
	_add_box("OuterBoundSouth", Vector3(0, 1.0, 7), Vector3(19, 2.0, 0.1), Color(0, 0, 0, 0), true, true)
	_add_box("StreamEdgeWest", Vector3(-1.62, -0.12, 0), Vector3(0.24, 0.28, 2.0), _sand, false)
	_add_box("StreamEdgeEast", Vector3(1.62, -0.12, 0), Vector3(0.24, 0.28, 2.0), _sand, false)
	# The asset worker's bridge is visual-only; collision is authored here.
	_assets_ready = _add_required_model("res://game/assets/studies/park25d/bridge.glb", Vector3.ZERO) and _assets_ready
	var deck_top := 0.16
	_add_box("BridgeDeckCollider", Vector3(0, deck_top * 0.5, 0), Vector3(4.0, deck_top, 2), Color(0, 0, 0, 0), true, true)
	_add_bridge_approach("BridgeApproachWest", -2.5, -2.0, deck_top)
	_add_bridge_approach("BridgeApproachEast", 2.5, 2.0, deck_top)
	_add_box("BridgeRailFront", Vector3(0, 0.58, -0.78), Vector3(3.34, 0.84, 0.14), Color(0, 0, 0, 0), true, true)
	_add_box("BridgeRailBack", Vector3(0, 0.58, 0.78), Vector3(3.34, 0.84, 0.14), Color(0, 0, 0, 0), true, true)
	# A solid earth wedge reaches the 1.2m east-bank overlook.
	_add_wedge_ramp()
	_add_box("UpperLand", Vector3(7.0, 0.6, 3.4), Vector3(2.0, 1.2, 4.2), _dark_grass, true)
	_add_box("CliffBoundary", Vector3(8.05, 1.8, 3.4), Vector3(0.1, 1.2, 4.2), Color(0, 0, 0, 0), true, true)
	_add_box("CliffTrim", Vector3(6.5, 0.74, 1.35), Vector3(3.0, 0.12, 0.22), _sand, false)

	_build_cottage(Vector3(-6.0, 0.0, -3.3))
	_build_landmark(Vector3(7.0, 1.2, 1.9))
	for p in [Vector3(-8, 0, -5), Vector3(-3, 0, 5), Vector3(7, 0, -4), Vector3(8.8, 0, -2)]:
		_build_tree(p)
	for p in [Vector3(-7.5, 0.0, 1.8), Vector3(-3.8, 0.0, -4.8), Vector3(6.3, 1.2, 4.8), Vector3(7.7, 1.2, 4.8)]:
		_build_flower(p)

func _add_wedge_ramp() -> void:
	var vertices := PackedVector3Array([
		Vector3(2, 0, 2.4), Vector3(6, 0, 2.4), Vector3(6, 1.2, 2.4),
		Vector3(2, 0, 4.4), Vector3(6, 0, 4.4), Vector3(6, 1.2, 4.4)
	])
	var indices := PackedInt32Array([0, 1, 2, 3, 5, 4, 0, 4, 1, 0, 3, 4, 1, 5, 2, 1, 4, 5, 0, 5, 3, 0, 2, 5])
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in indices:
		surface.set_uv(Vector2.ZERO)
		surface.add_vertex(vertices[index])
	surface.generate_normals()
	var mesh := surface.commit()
	var visual := MeshInstance3D.new()
	visual.name = "SolidWedgeRamp"
	visual.mesh = mesh
	visual.material_override = _material(_stone, false)
	add_child(visual)
	var body := StaticBody3D.new()
	body.name = "SolidWedgeRampCollider"
	var collision := CollisionShape3D.new()
	var convex := ConvexPolygonShape3D.new()
	convex.points = vertices
	collision.shape = convex
	body.add_child(collision)
	add_child(body)

func _build_cottage(pos: Vector3) -> void:
	_assets_ready = _add_required_model("res://game/assets/studies/park25d/cottage.glb", pos) and _assets_ready
	# GLB is visual-only. These are intentionally invisible authored colliders.
	_add_box("CottageCollider", pos + Vector3(0, 1.1, 0), Vector3(3.2, 2.2, 2.4), Color(0, 0, 0, 0), true, true)

func _add_bridge_approach(label: String, x_low: float, x_high: float, top: float) -> void:
	var vertices := PackedVector3Array([
		Vector3(x_low, 0, -1), Vector3(x_high, top, -1), Vector3(x_high, 0, -1),
		Vector3(x_low, 0, 1), Vector3(x_high, top, 1), Vector3(x_high, 0, 1)
	])
	var indices := PackedInt32Array([0, 2, 1, 3, 4, 5, 0, 5, 2, 0, 3, 5, 2, 4, 1, 2, 5, 4, 0, 4, 3, 0, 1, 4])
	if x_low > x_high:
		indices.reverse()
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in indices:
		surface.add_vertex(vertices[index])
	surface.generate_normals()
	var mesh := surface.commit()
	var visual := MeshInstance3D.new()
	visual.name = "%sVisual" % label
	visual.mesh = mesh
	visual.material_override = _material(_sand, false)
	add_child(visual)
	var body := StaticBody3D.new()
	body.name = label
	var collision := CollisionShape3D.new()
	var shape := ConvexPolygonShape3D.new()
	shape.points = vertices
	collision.shape = shape
	body.add_child(collision)
	add_child(body)

func _build_landmark(pos: Vector3) -> void:
	_add_box("LandmarkBase", pos + Vector3(0, 0.35, 0), Vector3(2.1, 0.7, 1.5), _stone, true)
	_add_box("LandmarkCap", pos + Vector3(0, 1.2, 0), Vector3(1.5, 1.0, 1.1), Color("#c88955"), true)
	_add_box("LandmarkRoof", pos + Vector3(0, 2.0, 0), Vector3(1.8, 0.2, 1.4), Color("#6b536d"), true)

func _add_required_model(path: String, pos: Vector3) -> bool:
	if not FileAccess.file_exists(path) or not ResourceLoader.exists(path):
		push_error("Required park study asset missing: %s" % path)
		_assets_ready = false
		return false
	var packed := load(path) as PackedScene
	if packed == null:
		push_error("Required park study asset failed to load: %s" % path)
		_assets_ready = false
		return false
	var model := packed.instantiate()
	model.name = path.get_file().get_basename()
	model.position = pos
	add_child(model)
	return true

func _build_tree(pos: Vector3) -> void:
	_add_box("TreeTrunk", pos + Vector3(0, 0.8, 0), Vector3(0.35, 1.6, 0.35), _wood, true)
	_add_box("TreeCanopy", pos + Vector3(0, 2.0, 0), Vector3(1.7, 1.5, 1.7), _dark_grass, false)
	_add_box("TreeCanopyLight", pos + Vector3(0.45, 2.3, 0.25), Vector3(0.65, 0.65, 0.65), _green, false)

func _build_flower(pos: Vector3) -> void:
	_add_box("FlowerStem", pos + Vector3(0, 0.2, 0), Vector3(0.06, 0.4, 0.06), _dark_grass, false)
	_add_box("FlowerHead", pos + Vector3(0, 0.45, 0), Vector3(0.24, 0.18, 0.24), Color("#f1cf67"), false)

func _build_fae() -> void:
	fae = CharacterBody3D.new()
	fae.name = "Fae3D"
	fae.floor_max_angle = deg_to_rad(55.0)
	fae.floor_snap_length = 0.25
	fae.position = Vector3(-3.2, 0.0, 0.0)
	fae.add_to_group("study_player_3d")
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.28
	capsule.height = 1.2
	shape.shape = capsule
	shape.position.y = 0.6
	fae.add_child(shape)
	_fae_sprite = Sprite3D.new()
	_fae_sprite.name = "FaeSprite"
	_fae_sprite.pixel_size = 0.05
	_fae_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_fae_sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	_fae_sprite.no_depth_test = false
	_fae_sprite.centered = true
	_fae_sprite.offset = Vector2(0, 12)
	fae.add_child(_fae_sprite)
	_set_fae_texture("south", false)
	var foot := MeshInstance3D.new()
	foot.name = "GroundShadow"
	var disc := CylinderMesh.new()
	disc.top_radius = 0.3
	disc.bottom_radius = 0.3
	disc.height = 0.012
	foot.mesh = disc
	foot.position.y = 0.015
	foot.material_override = _material(Color(0.08, 0.12, 0.1, 0.35), true)
	_ground_shadow = foot
	add_child(_ground_shadow)
	_shadow_ray = RayCast3D.new()
	_shadow_ray.target_position = Vector3(0, -4, 0)
	_shadow_ray.collision_mask = 1
	_shadow_ray.exclude_parent = false
	add_child(_shadow_ray)
	add_child(fae)
	_shadow_ray.add_exception(fae)

func _set_fae_texture(direction: String, walking: bool) -> void:
	var frame := int(floor(_walk_clock * 8.0)) % 4 if walking else 0
	var suffix := "walk_%s_%d.png" % [direction, frame] if walking else "idle_%s.png" % direction
	var path := "res://game/assets/sprites/characters/player/default/%s" % suffix
	if ResourceLoader.exists(path):
		_fae_sprite.texture = load(path)
		_fae_sprite.position = Vector3.ZERO

func _camera_relative_motion(input: Vector2) -> Vector3:
	var basis := _horizontal_camera_basis()
	var right: Vector3 = basis[0]
	var backward: Vector3 = basis[1]
	return (right.normalized() * input.x + backward.normalized() * input.y).normalized() if input.length() > 0.05 else Vector3.ZERO

func _horizontal_camera_basis() -> Array[Vector3]:
	var right := Vector3(camera.global_basis.x.x, 0.0, camera.global_basis.x.z).normalized()
	var backward := Vector3(camera.global_basis.z.x, 0.0, camera.global_basis.z.z)
	backward = (backward - right * backward.dot(right)).normalized()
	return [right, backward]

func _update_fae_facing(input: Vector2) -> void:
	var angle := atan2(input.x, input.y)
	var directions := ["south", "se", "east", "ne", "north", "nw", "west", "sw"]
	var index := posmod(int(round(angle / (PI / 4.0))), 8)
	_facing = directions[index]

func _update_shadow() -> void:
	if _ground_shadow == null or _shadow_ray == null:
		return
	_shadow_ray.global_position = fae.global_position + Vector3(0, 0.8, 0)
	_shadow_ray.force_raycast_update()
	var shadow_y := fae.global_position.y
	if _shadow_ray.is_colliding():
		shadow_y = _shadow_ray.get_collision_point().y + 0.015
	_ground_shadow.global_position = Vector3(fae.global_position.x, shadow_y, fae.global_position.z)

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "StudyCamera"
	camera.position = Vector3(7, 18, 18)
	camera.current = true
	camera.fov = 20.0
	add_child(camera)
	_set_projection(true)

func _set_projection(orthographic: bool) -> void:
	ortho_camera = orthographic
	if camera == null:
		return
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL if orthographic else Camera3D.PROJECTION_PERSPECTIVE
	camera.fov = 20.0
	camera.size = 14.4
	var view_direction := Vector3(7, 18, 18).normalized()
	var distance := 18.0 if orthographic else 14.4 / (2.0 * tan(deg_to_rad(camera.fov * 0.5)))
	camera.position = view_direction * distance
	camera.look_at(Vector3(0, 0.3, 0), Vector3.UP)
	_capture_note = "ORTHOGRAPHIC" if orthographic else "LONG-LENS PERSPECTIVE"

func _build_lighting() -> void:
	key_light = DirectionalLight3D.new()
	key_light.name = "WarmDirectionalLight"
	key_light.rotation_degrees = Vector3(-48, -32, 0)
	key_light.light_color = Color("#ffd19a")
	key_light.light_energy = 1.15
	key_light.shadow_enabled = true
	add_child(key_light)
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("#9bc4bd")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("#8cb5bd")
	environment.ambient_light_energy = 0.55
	world.environment = environment
	add_child(world)

func _build_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var hud_panel := ColorRect.new()
	hud_panel.position = Vector2(5, 4)
	hud_panel.size = Vector2(330, 54)
	hud_panel.color = Color(0.08, 0.12, 0.12, 0.82)
	layer.add_child(hud_panel)
	hud = Label.new()
	hud.position = Vector2(10, 7)
	hud.add_theme_font_size_override("font_size", 12)
	hud.add_theme_color_override("font_color", Color("#fff1c7"))
	hud.add_theme_color_override("font_shadow_color", Color("#263c3b"))
	hud.add_theme_constant_override("shadow_offset_x", 2)
	hud.add_theme_constant_override("shadow_offset_y", 2)
	layer.add_child(hud)

func _update_hud(input: Vector2) -> void:
	var floor_name := "ground"
	if fae.position.x > 2.0 and fae.position.y > 0.8:
		floor_name = "upper ledge 1.2m"
	hud.text = "PARK STUDY  •  %s\nArrows/WASD move  J jump  1/2 camera  L light\n%s  •  %s" % [floor_name, _capture_note, "airborne" if not fae.is_on_floor() else "grounded"]

func study_operation(data: Dictionary) -> Dictionary:
	var operation := str(data.get("operation", "checkpoint"))
	match operation:
		"camera":
			_set_projection(str(data.get("profile", "orthographic")) != "perspective")
			return {"ok": true, "operation": operation, "profile": _capture_note}
		"light":
			_light_enabled = bool(data.get("enabled", true))
			key_light.visible = _light_enabled
			return {"ok": true, "operation": operation, "enabled": _light_enabled}
		"jump":
			var start_y := fae.position.y
			var jump_press := InputEventKey.new()
			jump_press.keycode = KEY_J
			jump_press.pressed = true
			Input.parse_input_event(jump_press)
			var peak_y := start_y
			for _i in range(int(data.get("frames", 45))):
				await get_tree().physics_frame
				await get_tree().process_frame
				peak_y = max(peak_y, fae.position.y)
			var jump_release := InputEventKey.new()
			jump_release.keycode = KEY_J
			jump_release.pressed = false
			Input.parse_input_event(jump_release)
			var passed := peak_y > start_y + 0.25 and fae.is_on_floor()
			return {"ok": passed, "operation": operation, "start_y": start_y, "peak_y": peak_y, "landed": fae.is_on_floor()}
		"move_to":
			return await _drive_to(Vector3(float(data.get("x", fae.position.x)), float(data.get("y", fae.position.y)), float(data.get("z", fae.position.z))), int(data.get("max_frames", 360)))
		"probe_barrier":
			var start := fae.position
			var barrier_target := Vector3(float(data.get("x", fae.position.x)), float(data.get("y", fae.position.y)), float(data.get("z", fae.position.z)))
			var attempted := await _drive_to(barrier_target, int(data.get("max_frames", 120)))
			var blocked := not bool(attempted.get("reached", false)) and ((barrier_target.x > start.x and fae.position.x < -1.25) or (barrier_target.x < start.x and fae.position.x > 1.25))
			attempted["operation"] = operation
			attempted["blocked_at_water_edge"] = blocked
			attempted["ok"] = blocked and fae.is_on_floor()
			return attempted
		"probe_cliff":
			var cliff_target := Vector3(float(data.get("x", 9.0)), float(data.get("y", fae.position.y)), float(data.get("z", fae.position.z)))
			var cliff_attempt := await _drive_to(cliff_target, int(data.get("max_frames", 120)))
			var cliff_blocked := not bool(cliff_attempt.get("reached", false)) and fae.position.x < 8.1
			cliff_attempt["operation"] = operation
			cliff_attempt["blocked_at_cliff"] = cliff_blocked
			cliff_attempt["ok"] = cliff_blocked and fae.is_on_floor()
			return cliff_attempt
		"checkpoint":
			var label := str(data.get("label", "checkpoint"))
			var expected_y := float(data.get("floor_y", -999.0))
			var assets_required := bool(data.get("required_assets", false))
			var passed: bool = _assets_ready and (expected_y == -999.0 or abs(fae.position.y - expected_y) < 0.03) and fae.is_on_floor()
			if assets_required:
				passed = passed and _assets_ready
			return {"ok": passed, "operation": operation, "label": label, "position": _vec(fae.position), "floor_y": fae.position.y, "on_floor": fae.is_on_floor(), "required_assets": _assets_ready}
		"capture_note":
			return {"ok": true, "operation": operation, "profile": _capture_note, "position": _vec(fae.position), "sprite_proof": _sprite_screen_proof()}
		"sprite_probe":
			var proof := _sprite_screen_proof()
			return {"ok": bool(proof.get("visible", false)), "operation": operation, "sprite_proof": proof}
		"direction_probe":
			var expected := {"left": "west", "right": "east", "up": "north", "down": "south"}
			var observations: Array[Dictionary] = []
			for key_name in ["left", "right", "up", "down"]:
				var key_event := InputEventKey.new()
				key_event.keycode = {"left": KEY_LEFT, "right": KEY_RIGHT, "up": KEY_UP, "down": KEY_DOWN}[key_name]
				key_event.physical_keycode = key_event.keycode
				key_event.pressed = true
				Input.parse_input_event(key_event)
				await get_tree().physics_frame
				await get_tree().physics_frame
				var proof := _sprite_screen_proof()
				var actual := _facing
				key_event.pressed = false
				Input.parse_input_event(key_event)
				await get_tree().physics_frame
				observations.append({"input": key_name, "expected": expected[key_name], "actual": actual, "texture_loaded": proof.get("texture_loaded", false)})
			var passed := true
			for observation in observations:
				passed = passed and observation["expected"] == observation["actual"] and bool(observation["texture_loaded"])
			return {"ok": passed, "operation": operation, "directions": observations}
		_:
			return {"ok": false, "error": "unknown study operation: %s" % operation}

func _drive_to(target: Vector3, max_frames: int) -> Dictionary:
	var start := fae.position
	var reached := false
	for _i in range(min(max_frames, 900)):
		var delta := target - fae.position
		if Vector3(delta.x, 0, delta.z).length() < 0.12 and abs(delta.y) < 0.03 and fae.is_on_floor():
			reached = true
			break
		var world_direction := Vector3(delta.x, 0, delta.z).normalized()
		var basis := _horizontal_camera_basis()
		var right: Vector3 = basis[0]
		var backward: Vector3 = basis[1]
		var direction := Vector2(world_direction.dot(right), world_direction.dot(backward))
		_press_direction(direction)
		await get_tree().physics_frame
		await get_tree().process_frame
		_release_direction()
	return {"ok": reached, "operation": "move_to", "start": _vec(start), "position": _vec(fae.position), "target": _vec(target), "reached": reached, "on_floor": fae.is_on_floor(), "floor_y": fae.position.y, "floor_normal": _vec(fae.get_floor_normal())}

func _press_direction(direction: Vector2) -> void:
	Input.action_press("ui_left", max(0.0, -direction.x))
	Input.action_press("ui_right", max(0.0, direction.x))
	Input.action_press("ui_up", max(0.0, -direction.y))
	Input.action_press("ui_down", max(0.0, direction.y))

func _release_direction() -> void:
	Input.action_release("ui_left")
	Input.action_release("ui_right")
	Input.action_release("ui_up")
	Input.action_release("ui_down")

func _sprite_screen_proof() -> Dictionary:
	if camera == null or _fae_sprite == null or _fae_sprite.texture == null:
		return {"texture_loaded": false, "frame": Engine.get_physics_frames()}
	var texture_size := Vector2(_fae_sprite.texture.get_width(), _fae_sprite.texture.get_height()) * _fae_sprite.pixel_size
	var center := _fae_sprite.global_position + camera.global_basis.y * (_fae_sprite.offset.y * _fae_sprite.pixel_size)
	var half_width := camera.global_basis.x * texture_size.x * 0.5
	var half_height := camera.global_basis.y * texture_size.y * 0.5
	var corners := [center - half_width - half_height, center + half_width - half_height, center + half_width + half_height, center - half_width + half_height]
	var projected: Array[Vector2] = []
	var behind := false
	for corner in corners:
		behind = behind or camera.is_position_behind(corner)
		projected.append(camera.unproject_position(corner))
	var screen_box := Rect2(projected[0], Vector2.ZERO)
	for point in projected.slice(1):
		screen_box = screen_box.expand(point)
	var image := _fae_sprite.texture.get_image()
	var crop := image.get_used_rect() if image != null else Rect2i()
	var viewport_rect := Rect2(Vector2.ZERO, get_viewport().get_visible_rect().size)
	var visible := not behind and viewport_rect.intersects(screen_box) and crop.size.x > 0 and crop.size.y > 0
	return {"texture_loaded": true, "visible": visible, "behind_camera": behind, "frame": Engine.get_physics_frames(), "screen_box": {"x": screen_box.position.x, "y": screen_box.position.y, "width": screen_box.size.x, "height": screen_box.size.y}, "projected_corners": projected, "texture_alpha_bounds": {"x": crop.position.x, "y": crop.position.y, "width": crop.size.x, "height": crop.size.y}}

func _add_box(label: String, pos: Vector3, size: Vector3, color: Color, collision: bool, invisible: bool = false) -> Node3D:
	var holder: Node3D = StaticBody3D.new() if collision else Node3D.new()
	holder.name = label
	holder.position = pos
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.material_override = _material(color, false)
	mesh.visible = not invisible
	holder.add_child(mesh)
	if collision:
		var shape := CollisionShape3D.new()
		var box_shape := BoxShape3D.new()
		box_shape.size = size
		shape.shape = box_shape
		holder.add_child(shape)
	add_child(holder)
	return holder

func _material(color: Color, transparent: bool) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 1.0
	if transparent:
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	return material

func _vec(value: Vector3) -> Dictionary:
	return {"x": snappedf(value.x, 0.001), "y": snappedf(value.y, 0.001), "z": snappedf(value.z, 0.001)}
