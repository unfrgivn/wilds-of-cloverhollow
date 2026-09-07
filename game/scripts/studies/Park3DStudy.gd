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
var _presentation_mode := false
var _hud_panel: ColorRect
var _vegetation_footprints: Array[Dictionary] = []
var _fae_sprite: Sprite3D
var _ground_shadow: MeshInstance3D
var _shadow_ray: RayCast3D
var _facing := "south"
var _walk_clock := 0.0
var _assets_ready := true
const SHOWCASE_ROOT := "res://game/assets/studies/park25d/showcase/"
const TEXTURE_UV_SCALE := 0.625
const UPPER_TOP := 1.2

var _green := Color("#6f9d5d")
var _dark_grass := Color("#476b50")
var _sand := Color("#d2ba78")
var _grass_shadow := Color("#355b4b")

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
	_update_hud()

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
		elif event.keycode == KEY_H:
			_set_presentation_mode(not _presentation_mode)

func _build_world() -> void:
	# Two raised, layered banks leave a real water channel between them.
	_add_box("WestBank", Vector3(-5.5, -0.35, 0), Vector3(8, 0.7, 14), _grass_shadow, true, true)
	_add_box("EastBank", Vector3(5.5, -0.35, 0), Vector3(8, 0.7, 14), _green, true, true)
	_add_textured_box("WestBankMasonry", Vector3(-5.5, -0.35, 0), Vector3(8, 0.7, 14), "stone")
	_add_textured_box("EastBankMasonry", Vector3(5.5, -0.35, 0), Vector3(8, 0.7, 14), "stone")
	_add_textured_patch("WestGrassSurface", [Vector3(-9.5, 0.002, -7), Vector3(-1.5, 0.002, -7), Vector3(-1.5, 0.002, 7), Vector3(-9.5, 0.002, 7)], "grass")
	_add_textured_patch("EastGrassSurface", [Vector3(1.5, 0.002, -7), Vector3(9.5, 0.002, -7), Vector3(9.5, 0.002, 7), Vector3(1.5, 0.002, 7)], "grass")
	# Layered native-colour patches break the banks into an intentional garden floor.
	_add_textured_patch("WestSoil", [Vector3(-8.8, .006, -5.9), Vector3(-4.8, .006, -6.2), Vector3(-3.2, .006, -4.4), Vector3(-4.5, .006, -3.0), Vector3(-8.8, .006, -3.3)], "soil")
	_add_textured_patch("EastSoil", [Vector3(4.0, .006, 5.6), Vector3(8.7, .006, 5.6), Vector3(8.7, .006, 6.6), Vector3(3.9, .006, 6.6)], "soil")
	_add_textured_patch("StreamWater", [Vector3(-1.42, -.42, -7), Vector3(1.42, -.42, -7), Vector3(1.42, -.42, 7), Vector3(-1.42, -.42, 7)], "water")
	for side in [-1.0, 1.0]:
		for z in [-4.0, 4.0]:
			_add_box("StoneWetLine", Vector3(side * 1.404, -.425, z), Vector3(.016, .15, 6.0), Color("#2a6a8a"), false)
		for z in [-6.4, -5.0, -3.7, -2.1, 1.5, 2.8, 4.3, 5.8]:
			_add_box("BankFoam", Vector3(side * 1.367, -.414, z), Vector3(.065, .006, .34), Color("#5aa8d7"), false)
	for z in [-5.2, -2.8, 2.2, 5.0]:
		_add_box("WaterRipple", Vector3(0, -.375, z), Vector3(1.55, .012, .035), Color("#9bc7bd"), false)
	_add_path()
	# Continuous banks leave only the two-metre bridge approach open.
	for z in [-4.0, 4.0]:
		_add_box("WaterBarrierWest", Vector3(-1.5, -0.05, z), Vector3(0.18, 1.0, 6.0), _sand, true, true)
		_add_box("WaterBarrierEast", Vector3(1.5, -0.05, z), Vector3(0.18, 1.0, 6.0), _sand, true, true)
		_add_textured_box("WestMossWall", Vector3(-1.5, -0.05, z), Vector3(0.18, 1.0, 6.0), "stone")
		_add_textured_box("EastMossWall", Vector3(1.5, -0.05, z), Vector3(0.18, 1.0, 6.0), "stone")
	_add_box("OuterBoundWest", Vector3(-9.5, 1.0, 0), Vector3(0.1, 2.0, 14), Color(0, 0, 0, 0), true, true)
	_add_box("OuterBoundEast", Vector3(9.5, 1.0, 0), Vector3(0.1, 2.0, 14), Color(0, 0, 0, 0), true, true)
	_add_box("OuterBoundNorth", Vector3(0, 1.0, -7), Vector3(19, 2.0, 0.1), Color(0, 0, 0, 0), true, true)
	_add_box("OuterBoundSouth", Vector3(0, 1.0, 7), Vector3(19, 2.0, 0.1), Color(0, 0, 0, 0), true, true)
	_add_box("StreamEdgeWest", Vector3(-1.62, -0.12, 0), Vector3(0.24, 0.28, 2.0), _sand, false)
	_add_box("StreamEdgeEast", Vector3(1.62, -0.12, 0), Vector3(0.24, 0.28, 2.0), _sand, false)
	# The asset worker's bridge is visual-only; collision is authored here.
	_assets_ready = _add_required_model(SHOWCASE_ROOT + "bridge.glb", Vector3.ZERO) and _assets_ready
	var deck_top := 0.16
	_add_box("BridgeDeckCollider", Vector3(0, deck_top * 0.5, 0), Vector3(4.0, deck_top, 2), Color(0, 0, 0, 0), true, true)
	_add_bridge_approach("BridgeApproachWest", -2.5, -2.0, deck_top)
	_add_bridge_approach("BridgeApproachEast", 2.5, 2.0, deck_top)
	_add_box("BridgeRailFront", Vector3(0, 0.58, -0.78), Vector3(3.34, 0.84, 0.14), Color(0, 0, 0, 0), true, true)
	_add_box("BridgeRailBack", Vector3(0, 0.58, 0.78), Vector3(3.34, 0.84, 0.14), Color(0, 0, 0, 0), true, true)
	# A solid earth wedge reaches the 1.2m east-bank overlook.
	_add_wedge_ramp()
	_add_box("UpperLand", Vector3(7.0, 0.6, 3.4), Vector3(2.0, 1.2, 4.2), _dark_grass, true, true)
	_add_textured_box("UpperStoneCliff", Vector3(7.0, 0.6, 3.4), Vector3(2.0, 1.2, 4.2), "stone")
	_add_textured_patch("UpperGrassCap", [Vector3(6.0, 1.202, 1.3), Vector3(8.0, 1.202, 1.3), Vector3(8.0, 1.202, 5.5), Vector3(6.0, 1.202, 5.5)], "grass")
	_add_box("CliffBoundary", Vector3(8.05, 1.8, 3.4), Vector3(0.1, 1.2, 4.2), Color(0, 0, 0, 0), true, true)

	_build_cottage(Vector3(-6.0, 0.0, -3.3))
	_build_landmark(Vector3(7.0, 1.2, 2.2))
	_add_vegetation("oak_a", Vector3(-8, 0, -5))
	_add_vegetation("oak_b", Vector3(-8.3, 0, -1.0))
	_add_vegetation("oak_a", Vector3(-3.1, 0, 5))
	_add_vegetation("oak_b", Vector3(7.2, 0, -4.5))
	_add_vegetation("pine", Vector3(-8.4, 0, 3.8))
	_add_vegetation("bush", Vector3(-7.5, 0, 1.8))
	_add_vegetation("bush", Vector3(6.3, 1.2, 4.8))
	_add_vegetation("flowers", Vector3(-3.8, 0, -4.8))
	_add_vegetation("flowers", Vector3(6.8, 1.2, 4.8))
	_add_vegetation("reeds", Vector3(-2.0, 0, -5.8))
	_add_vegetation("reeds", Vector3(2.0, 0, 5.5))
	_add_vegetation("grass_tuft", Vector3(-4.1, 0, -1.9))
	_add_vegetation("rock", Vector3(-2.4, 0, 5.9))

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
	visual.material_override = _textured_material("stone", true)
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
	_assets_ready = _add_required_model(SHOWCASE_ROOT + "cottage.glb", pos) and _assets_ready
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
	visual.material_override = _textured_material("path", true)
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
	# A small lookout shrine, with open posts and a pitched cap instead of stacked boxes.
	var base_top := 0.16
	var roof_base := 1.55
	_add_textured_box("LookoutStoneBase", pos + Vector3(0, base_top * 0.5, 0), Vector3(1.9, base_top, 1.1), "stone")
	for x in [-.82, .82]:
		for z in [-.42, .42]: _add_textured_box("LookoutPost", pos + Vector3(x, (base_top + roof_base) * 0.5, z), Vector3(.18, roof_base - base_top, .18), "wood")
	var seat_bottom := 0.43
	_add_textured_box("LookoutBenchSeat", pos + Vector3(0, seat_bottom + .05, .28), Vector3(1.25, .10, .28), "wood")
	for x in [-.45, .45]:
		_add_textured_box("LookoutBenchLeg", pos + Vector3(x, (base_top + seat_bottom) * 0.5, .28), Vector3(.10, seat_bottom - base_top, .18), "wood")
	_add_textured_box("LookoutSign", pos + Vector3(0, .75, -.42), Vector3(.78, .38, .06), "wood")
	_add_textured_box("LookoutSignSupport", pos + Vector3(0, .8, -.42), Vector3(1.64, .1, .12), "wood")
	var roof := _pyramid_mesh("LookoutRoof", pos + Vector3(0, roof_base, 0), Vector2(.98, .58), .48, Color("#8f4a35"))
	add_child(roof)
	_add_textured_box("GardenPotWest", pos + Vector3(-.65, base_top + .22, .28), Vector3(.26, .44, .26), "stone")
	_add_textured_box("GardenPotEast", pos + Vector3(.65, base_top + .22, .28), Vector3(.26, .44, .26), "stone")

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

func _add_path() -> void:
	_add_textured_patch("PathWest", [Vector3(-6.2, .012, -2.05), Vector3(-5.45, .012, -2.05), Vector3(-2.5, .012, -.82), Vector3(-2.5, .012, .82), Vector3(-5.45, .012, -1.2)], "path")
	_add_textured_patch("PathBridgeWest", [Vector3(-4.8, .012, -.82), Vector3(-2.5, .012, -.82), Vector3(-2.5, .012, .82), Vector3(-4.8, .012, .82)], "path")
	_add_textured_patch("PathBridgeEast", [Vector3(2.0, .172, -.82), Vector3(2.5, .012, -.82), Vector3(2.5, .012, .82), Vector3(2.0, .172, .82)], "path")
	# The east approach follows the collision ramp, then becomes level on the ledge.
	_add_textured_patch("PathRamp", [Vector3(2.0, _ramp_surface_y(2.0), 3.05), Vector3(6.0, _ramp_surface_y(6.0), 3.05), Vector3(6.0, _ramp_surface_y(6.0), 3.75), Vector3(2.0, _ramp_surface_y(2.0), 3.75)], "path")
	_add_textured_patch("PathUpper", [Vector3(6.0, UPPER_TOP + .012, 3.05), Vector3(8.0, UPPER_TOP + .012, 3.05), Vector3(8.0, UPPER_TOP + .012, 3.75), Vector3(6.0, UPPER_TOP + .012, 3.75)], "path")

func _ramp_surface_y(x: float) -> float:
	return 0.3 * (x - 2.0) + 0.012

func _add_textured_patch(label: String, points: Array[Vector3], texture_name: String) -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(1, points.size() - 1):
		for point in [points[0], points[i], points[i + 1]]:
			surface.set_uv(Vector2(point.x, point.z) * TEXTURE_UV_SCALE)
			surface.add_vertex(point)
	surface.generate_normals()
	var mesh := MeshInstance3D.new()
	mesh.name = label
	mesh.mesh = surface.commit()
	mesh.material_override = _textured_material(texture_name)
	add_child(mesh)

func _add_vegetation(asset_name: String, pos: Vector3) -> void:
	var path := SHOWCASE_ROOT + asset_name + ".png"
	if not FileAccess.file_exists(path) or not ResourceLoader.exists(path):
		_assets_ready = false
		push_error("Required park study vegetation missing: %s" % path)
		return
	var sprite := Sprite3D.new()
	sprite.name = "Vegetation_%s" % asset_name
	sprite.texture = load(path)
	sprite.pixel_size = 0.05
	sprite.centered = true
	sprite.offset = Vector2(0, sprite.texture.get_height() / 2.0)
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	sprite.no_depth_test = false
	sprite.position = pos
	add_child(sprite)
	_vegetation_footprints.append({"node": sprite, "foot": pos, "texture_height": sprite.texture.get_height()})
	if asset_name.begins_with("oak_") or asset_name == "pine":
		_add_box("TreeTrunkCollision", pos + Vector3(0, .6, 0), Vector3(.28, 1.2, .28), Color("#5a4a3a"), true, true)

func _add_textured_box(label: String, pos: Vector3, size: Vector3, texture_name: String) -> void:
	var mesh := MeshInstance3D.new()
	mesh.name = label
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.position = pos
	mesh.material_override = _textured_material(texture_name, true)
	add_child(mesh, true)

func _pyramid_mesh(label: String, pos: Vector3, footprint: Vector2, height: float, color: Color) -> MeshInstance3D:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var p := [Vector3(-footprint.x, 0, -footprint.y), Vector3(footprint.x, 0, -footprint.y), Vector3(footprint.x, 0, footprint.y), Vector3(-footprint.x, 0, footprint.y), Vector3(0, height, 0)]
	for face in [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [0, 3, 2], [0, 2, 1]]:
		for index in face:
			surface.set_uv(Vector2(p[index].x, p[index].z) * TEXTURE_UV_SCALE)
			surface.add_vertex(p[index])
	surface.generate_normals()
	var mesh := MeshInstance3D.new()
	mesh.name = label
	mesh.mesh = surface.commit()
	mesh.material_override = _textured_material("roof") if label == "LookoutRoof" else _material(color, false)
	mesh.position = pos
	return mesh

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
	key_light.shadow_blur = 0.5
	key_light.shadow_normal_bias = 0.5
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
	_hud_panel = ColorRect.new()
	_hud_panel.position = Vector2(5, 4)
	_hud_panel.color = Color(0.08, 0.12, 0.12, 0.72)
	layer.add_child(_hud_panel)
	hud = Label.new()
	hud.position = Vector2(10, 5)
	hud.add_theme_font_size_override("font_size", 10)
	hud.add_theme_color_override("font_color", Color("#fff1c7"))
	hud.add_theme_color_override("font_shadow_color", Color("#263c3b"))
	hud.add_theme_constant_override("shadow_offset_x", 2)
	hud.add_theme_constant_override("shadow_offset_y", 2)
	layer.add_child(hud)
	hud.text = "CLOVERBROOK  •  ORTHOGRAPHIC"
	_refresh_hud_bounds()

func _set_presentation_mode(enabled: bool) -> void:
	_presentation_mode = enabled
	if hud != null:
		hud.visible = not enabled
		_hud_panel.visible = not enabled

func _update_hud() -> void:
	hud.text = "CLOVERBROOK  •  %s" % _capture_note
	_refresh_hud_bounds()

func _refresh_hud_bounds() -> void:
	if hud == null or _hud_panel == null:
		return
	hud.size = hud.get_minimum_size()
	_hud_panel.size = hud.position + hud.size + Vector2(8, 6)

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
		"presentation":
			_set_presentation_mode(bool(data.get("enabled", true)))
			return {"ok": true, "operation": operation, "enabled": _presentation_mode}
		"geometry_assert":
			return _geometry_assertions()
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

func _geometry_assertions() -> Dictionary:
	var lookout := _lookout_geometry_observations()
	var plants := _plant_geometry_observations()
	var paths := _path_vertex_observations()
	var hud_observation := _hud_geometry_observation()
	var passed := _assets_ready and bool(lookout["ok"]) and bool(plants["ok"]) and bool(paths["ok"]) and bool(hud_observation["ok"])
	return {"ok": passed, "operation": "geometry_assert", "assets_ready": _assets_ready, "plants_grounded": plants, "plant_count": _vegetation_footprints.size(), "path_surfaces": paths, "lookout_contacts": lookout, "hud_fits": hud_observation}

func _mesh_nodes_with_prefix(prefix: String) -> Array[MeshInstance3D]:
	var matches: Array[MeshInstance3D] = []
	for child in get_children():
		if child is MeshInstance3D and str(child.name).begins_with(prefix):
			matches.append(child as MeshInstance3D)
	return matches

func _mesh_nodes_under(node: Node) -> Array[MeshInstance3D]:
	var matches: Array[MeshInstance3D] = []
	for child in node.get_children():
		if child is MeshInstance3D:
			matches.append(child as MeshInstance3D)
		matches.append_array(_mesh_nodes_under(child))
	return matches

func _world_aabb_for_node(node: Node) -> Dictionary:
	var meshes: Array[MeshInstance3D] = []
	if node == null:
		return {"ok": false, "aabb": AABB()}
	if node is MeshInstance3D:
		meshes.append(node as MeshInstance3D)
	meshes.append_array(_mesh_nodes_under(node))
	if meshes.is_empty():
		return {"ok": false, "aabb": AABB()}
	var bounds := meshes[0].global_transform * meshes[0].get_aabb()
	for mesh in meshes.slice(1):
		bounds = bounds.merge(mesh.global_transform * mesh.get_aabb())
	return {"ok": true, "aabb": bounds}

func _aabb_contact(label: String, lower: AABB, upper: AABB) -> Dictionary:
	var bottom := lower.position.y
	var top := lower.end.y
	var target := upper.position.y
	var delta: float = abs(top - target)
	var overlaps_x: bool = lower.position.x <= upper.end.x and upper.position.x <= lower.end.x
	var overlaps_z: bool = lower.position.z <= upper.end.z and upper.position.z <= lower.end.z
	return {"part": label, "lower_bottom": bottom, "lower_top": top, "upper_bottom": target, "delta": delta, "xz_overlap": overlaps_x and overlaps_z, "ok": delta < 0.003 and overlaps_x and overlaps_z}

func _lookout_geometry_observations() -> Dictionary:
	var base_node := get_node_or_null("LookoutStoneBase")
	var roof_node := get_node_or_null("LookoutRoof")
	var base_data := _world_aabb_for_node(base_node) if base_node != null else {"ok": false}
	var roof_data := _world_aabb_for_node(roof_node) if roof_node != null else {"ok": false}
	var contacts: Array[Dictionary] = []
	var posts := _mesh_nodes_with_prefix("LookoutPost")
	var legs := _mesh_nodes_with_prefix("LookoutBenchLeg")
	var pots := _mesh_nodes_with_prefix("GardenPot")
	var valid := bool(base_data.get("ok", false)) and bool(roof_data.get("ok", false)) and posts.size() == 4 and legs.size() == 2 and pots.size() == 2
	if valid:
		var base: AABB = base_data["aabb"]
		var roof: AABB = roof_data["aabb"]
		for post in posts:
			var post_data := _world_aabb_for_node(post)
			var post_box: AABB = post_data["aabb"]
			var base_contact := _aabb_contact(str(post.name) + "_base", base, post_box)
			var roof_contact := _aabb_contact(str(post.name) + "_roof", post_box, roof)
			contacts.append(base_contact)
			contacts.append(roof_contact)
			valid = valid and bool(base_contact["ok"]) and bool(roof_contact["ok"])
		var seat_node := get_node_or_null("LookoutBenchSeat")
		var seat_data := _world_aabb_for_node(seat_node) if seat_node != null else {"ok": false}
		valid = valid and bool(seat_data.get("ok", false))
		if bool(seat_data.get("ok", false)):
			var seat: AABB = seat_data["aabb"]
			for leg in legs:
				var leg_box: AABB = _world_aabb_for_node(leg)["aabb"]
				var leg_contact := _aabb_contact(str(leg.name) + "_base", base, leg_box)
				var seat_contact := _aabb_contact(str(leg.name) + "_seat", leg_box, seat)
				contacts.append(leg_contact)
				contacts.append(seat_contact)
				valid = valid and bool(leg_contact["ok"]) and bool(seat_contact["ok"])
		var pots_inside := true
		for pot in pots:
			var pot_box: AABB = _world_aabb_for_node(pot)["aabb"]
			var pot_contact := _aabb_contact(str(pot.name) + "_base", base, pot_box)
			var footprint := base.encloses(AABB(Vector3(pot_box.position.x, base.position.y, pot_box.position.z), Vector3(pot_box.size.x, 0, pot_box.size.z)))
			pot_contact["footprint_inside_base"] = footprint
			pots_inside = pots_inside and bool(pot_contact["ok"]) and footprint
			contacts.append(pot_contact)
			valid = valid and pots_inside
	return {"ok": valid and contacts.size() == 14, "counts": {"posts": posts.size(), "legs": legs.size(), "pots": pots.size()}, "contacts": contacts}

func _plant_geometry_observations() -> Dictionary:
	var observations: Array[Dictionary] = []
	var valid := _vegetation_footprints.size() == 13
	var west_data := _world_aabb_for_node(get_node_or_null("WestBank"))
	var east_data := _world_aabb_for_node(get_node_or_null("EastBank"))
	var upper_data := _world_aabb_for_node(get_node_or_null("UpperLand"))
	valid = valid and bool(west_data.get("ok", false)) and bool(east_data.get("ok", false)) and bool(upper_data.get("ok", false))
	for record in _vegetation_footprints:
		var sprite: Sprite3D = record["node"]
		var texture := sprite.texture
		var width := float(texture.get_width()) * sprite.pixel_size if texture != null else 0.0
		var height := float(texture.get_height()) * sprite.pixel_size if texture != null else 0.0
		var expected_offset := height / (2.0 * sprite.pixel_size) if not is_zero_approx(sprite.pixel_size) else 0.0
		var foot := sprite.global_position
		var bank_name := ""
		var bank := AABB()
		for candidate in [{"name": "WestBank", "data": west_data}, {"name": "EastBank", "data": east_data}, {"name": "UpperLand", "data": upper_data}]:
			var candidate_data: Dictionary = candidate["data"]
			if not bool(candidate_data.get("ok", false)):
				continue
			var candidate_box: AABB = candidate_data["aabb"]
			var on_floor: bool = abs(foot.y - candidate_box.end.y) < 0.003
			var on_footprint: bool = foot.x >= candidate_box.position.x and foot.x <= candidate_box.end.x and foot.z >= candidate_box.position.z and foot.z <= candidate_box.end.z
			if on_floor and on_footprint:
				bank_name = str(candidate["name"])
				bank = candidate_box
				break
		var canopy_overhang := {"width": width, "height": height, "allowed": true}
		var footprint := not bank_name.is_empty()
		var observation := {"name": str(sprite.name), "foot": _vec(foot), "offset": sprite.offset.y, "expected_offset": expected_offset, "bank": bank_name, "bank_top": bank.end.y, "footprint_inside_bank": footprint, "canopy_overhang": canopy_overhang, "ok": sprite.centered and abs(sprite.offset.y - expected_offset) < 0.001 and footprint}
		observations.append(observation)
		valid = valid and bool(observation["ok"])
	return {"ok": valid, "observations": observations}

func _path_vertex_observations() -> Dictionary:
	var path_names := ["PathWest", "PathBridgeWest", "PathBridgeEast", "PathRamp", "PathUpper"]
	var observations: Array[Dictionary] = []
	var valid := true
	for label in path_names:
		var mesh := get_node_or_null(label) as MeshInstance3D
		var path_observation := {"path": label, "vertices": [], "ok": false}
		if mesh == null or mesh.mesh == null or mesh.mesh.get_surface_count() == 0:
			observations.append(path_observation)
			valid = false
			continue
		var arrays := mesh.mesh.surface_get_arrays(0)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		var normals: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
		var vertex_ok := vertices.size() > 0 and normals.size() == vertices.size()
		for index in range(vertices.size()):
			var point := mesh.global_transform * vertices[index]
			var expected_y := 0.012
			var expected_normal := Vector3.UP
			if label == "PathRamp":
				expected_y = 0.3 * (point.x - 2.0) + 0.012
				expected_normal = Vector3(-0.3, 1.0, 0.0).normalized()
			elif label == "PathBridgeEast":
				expected_y = 0.32 * (2.5 - point.x) + 0.012
				expected_normal = Vector3(0.32, 1.0, 0.0).normalized()
			elif label == "PathUpper":
				expected_y = 1.212
			var observed_normal := (mesh.global_basis * normals[index]).normalized()
			var normal_dot := observed_normal.dot(expected_normal)
			var point_ok: bool = abs(point.y - expected_y) < 0.003 and normal_dot > 0.999
			vertex_ok = vertex_ok and point_ok
			(path_observation["vertices"] as Array).append({"position": _vec(point), "expected_y": expected_y, "normal": _vec(observed_normal), "expected_normal": _vec(expected_normal), "normal_dot": normal_dot, "ok": point_ok})
		path_observation["ok"] = vertex_ok
		observations.append(path_observation)
		valid = valid and vertex_ok
	return {"ok": valid, "observations": observations}

func _hud_geometry_observation() -> Dictionary:
	if _hud_panel == null or hud == null:
		return {"ok": false, "reason": "HUD nodes missing"}
	var viewport_rect := get_viewport().get_visible_rect()
	var panel_rect := _hud_panel.get_global_rect()
	var label_rect := hud.get_global_rect()
	var ok := viewport_rect.encloses(panel_rect) and panel_rect.encloses(label_rect)
	return {"ok": ok, "viewport": viewport_rect, "panel": panel_rect, "label": label_rect}

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

func _textured_material(texture_name: String, triplanar: bool = false) -> StandardMaterial3D:
	var path := SHOWCASE_ROOT + texture_name + ".png"
	if not FileAccess.file_exists(path) or not ResourceLoader.exists(path):
		_assets_ready = false
		push_error("Required park study texture missing: %s" % path)
		return _material(Color("#2f4b44"), false)
	var material := StandardMaterial3D.new()
	material.albedo_texture = load(path)
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	material.texture_repeat = true
	material.uv1_scale = Vector3(TEXTURE_UV_SCALE, TEXTURE_UV_SCALE, TEXTURE_UV_SCALE) if triplanar else Vector3.ONE
	material.uv1_triplanar = triplanar
	material.uv1_world_triplanar = triplanar
	material.roughness = 1.0
	return material

func _vec(value: Vector3) -> Dictionary:
	return {"x": snappedf(value.x, 0.001), "y": snappedf(value.y, 0.001), "z": snappedf(value.z, 0.001)}
