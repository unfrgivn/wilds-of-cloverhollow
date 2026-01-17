extends Node
class_name SceneRunner

const DEFAULT_SCENE_ID: String = "town_square_01"
const PLAYER_Z_INDEX: int = 2
const OVERHANG_Z_INDEX: int = 50
const DEBUG_EXIT_COLOR: Color = Color(0.0, 1.0, 1.0, 0.3)
const DEBUG_EXIT_Z_INDEX: int = 100
const DEBUG_OVERLAY_Z_INDEX: int = 90
const DEBUG_SPAWN_COLOR: Color = Color(1.0, 0.3, 0.8, 0.5)
const DEBUG_SPAWN_SIZE: float = 12.0
const DEBUG_WALKMASK_COLOR: Color = Color(0.1, 1.0, 0.8, 0.35)
const DEBUG_NAV_COLOR: Color = Color(0.2, 0.8, 1.0, 0.6)
const DECAL_Z_INDEX: int = -5
const DEBUG_VISUAL_TOGGLE_KEY: Key = KEY_F1
const DEBUG_TOGGLE_KEY: Key = KEY_F2
const DEBUG_OVERHANG_TOGGLE_KEY: Key = KEY_F3
const DEBUG_DECAL_TOGGLE_KEY: Key = KEY_F4
const DEBUG_WALKMASK_TOGGLE_KEY: Key = KEY_F5
const DEBUG_NAV_TOGGLE_KEY: Key = KEY_F6
const CLEAN_SCREENSHOT_KEY: Key = KEY_F9
const NPC_SCENE_PATH: String = "res://actors/NpcAgent.tscn"
const NPC_COUNT: int = 2

const PROP_DEF_SCRIPT: Script = preload("res://game/props/prop_def.gd")

var _debug_exit_markers: bool = true
var _debug_overhangs: bool = true
var _debug_decals: bool = true
var _debug_walkmask: bool = false
var _debug_nav: bool = false

var _scene_root: Node2D
var _debug_label: Label
var _walkmask: WalkMask
var _player: Area2D
var _world_root: Node2D
var _y_sort_root: Node2D
var _overhang_root: Node2D
var _nav_region: NavigationRegion2D
var _decals_root: Node2D
var _debug_overlay_root: Node2D
var _walkmask_overlay: Sprite2D
var _nav_overlay_root: Node2D
var _spawn_marker: Polygon2D
var _debug_visuals: bool = true

func _ready() -> void:
	var parent_node: Node = get_parent()
	_scene_root = parent_node.get_node("SceneRoot") as Node2D
	var ui_node: Node = parent_node.get_node("UI")
	_debug_label = ui_node.get_node_or_null("DebugLabel") as Label
	load_scene(DEFAULT_SCENE_ID)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key_event: InputEventKey = event
		if key_event.keycode == DEBUG_VISUAL_TOGGLE_KEY:
			_toggle_debug_visuals()
		elif key_event.keycode == DEBUG_TOGGLE_KEY:
			_debug_exit_markers = not _debug_exit_markers
			_update_exit_marker_visibility()
			var state: String = "on" if _debug_exit_markers else "off"
			_set_debug_text("Exit markers: %s" % state)
		elif key_event.keycode == DEBUG_OVERHANG_TOGGLE_KEY:
			_debug_overhangs = not _debug_overhangs
			_update_overhang_visibility()
			var overhang_state: String = "on" if _debug_overhangs else "off"
			_set_debug_text("Overhangs: %s" % overhang_state)
		elif key_event.keycode == DEBUG_DECAL_TOGGLE_KEY:
			_debug_decals = not _debug_decals
			_update_decal_visibility()
			var decal_state: String = "on" if _debug_decals else "off"
			_set_debug_text("Decals: %s" % decal_state)
		elif key_event.keycode == DEBUG_WALKMASK_TOGGLE_KEY:
			_debug_walkmask = not _debug_walkmask
			_update_walkmask_overlay()
			var walkmask_state: String = "on" if _debug_walkmask else "off"
			_set_debug_text("Walkmask: %s" % walkmask_state)
		elif key_event.keycode == DEBUG_NAV_TOGGLE_KEY:
			_debug_nav = not _debug_nav
			_update_nav_overlay()
			var nav_state: String = "on" if _debug_nav else "off"
			_set_debug_text("Nav overlay: %s" % nav_state)
		elif key_event.keycode == CLEAN_SCREENSHOT_KEY:
			_activate_clean_screenshot()

func load_scene(scene_id: String) -> void:
	_clear_scene_root()
	var scene_folder: String = "res://content/scenes/%s" % scene_id
	var blueprint: Blueprint = Blueprint.load_from_scene_folder(scene_folder)
	if blueprint == null:
		push_error("[SceneRunner] Failed to load blueprint for %s" % scene_id)
		return
	_build_world(blueprint)
	_walkmask = WalkMask.new()
	_walkmask.load_from_path(blueprint.assets["walkmask_player"])
	_build_walkmask_overlay(blueprint.assets["walkmask_player"])
	_spawn_decals(blueprint)
	_spawn_props(blueprint)
	_spawn_player(blueprint)

	_spawn_npcs(blueprint)
	_spawn_hotspots(blueprint)
	_spawn_exits(blueprint)
	_apply_debug_visuals()
	_set_debug_text("Loaded scene: %s" % scene_id)
	print("[SceneRunner] Loaded scene: %s" % scene_id)

func _clear_scene_root() -> void:
	for child in _scene_root.get_children():
		_scene_root.remove_child(child)
		child.queue_free()
	_world_root = null
	_y_sort_root = null
	_overhang_root = null
	_decals_root = null
	_nav_region = null
	_debug_overlay_root = null
	_walkmask_overlay = null
	_nav_overlay_root = null
	_spawn_marker = null
	_walkmask = null

func _build_world(blueprint: Blueprint) -> void:
	_world_root = Node2D.new()
	_world_root.name = "World"
	_scene_root.add_child(_world_root)

	var ground: Sprite2D = Sprite2D.new()
	ground.name = "Ground"
	var plate_base_path: String = str(blueprint.assets.get("plate_base", "")).strip_edges()
	var ground_texture: Texture2D = _load_texture(plate_base_path, "plate_base")
	if ground_texture == null:
		ground_texture = _load_texture(str(blueprint.assets["ground"]), "ground")
	ground.texture = ground_texture
	ground.centered = false
	ground.position = Vector2.ZERO
	_world_root.add_child(ground)

	_nav_region = NavigationRegion2D.new()
	_nav_region.name = "NavRegion"
	var navpoly: NavigationPolygon = load(blueprint.assets["navpoly"]) as NavigationPolygon
	if navpoly == null:
		push_warning("[SceneRunner] Missing navpoly: %s" % blueprint.assets["navpoly"])
	else:
		_nav_region.navigation_polygon = navpoly
	_world_root.add_child(_nav_region)

	_y_sort_root = Node2D.new()
	_y_sort_root.name = "YSortRoot"
	_y_sort_root.y_sort_enabled = true
	_world_root.add_child(_y_sort_root)

	_overhang_root = Node2D.new()
	_overhang_root.name = "OverhangRoot"
	_overhang_root.z_index = OVERHANG_Z_INDEX
	_overhang_root.visible = _debug_overhangs
	_world_root.add_child(_overhang_root)
	var plate_overhang_path: String = str(blueprint.assets.get("plate_overhang", "")).strip_edges()
	var plate_overhang_texture: Texture2D = _load_texture(plate_overhang_path, "plate_overhang")
	if plate_overhang_texture != null:
		var plate_overhang: Sprite2D = Sprite2D.new()
		plate_overhang.name = "PlateOverhang"
		plate_overhang.texture = plate_overhang_texture
		plate_overhang.centered = false
		plate_overhang.position = Vector2.ZERO
		plate_overhang.z_index = OVERHANG_Z_INDEX
		_overhang_root.add_child(plate_overhang)

	_decals_root = Node2D.new()
	_decals_root.name = "DecalsRoot"
	_decals_root.z_index = DECAL_Z_INDEX
	_decals_root.visible = _debug_decals
	_world_root.add_child(_decals_root)

	_debug_overlay_root = Node2D.new()
	_debug_overlay_root.name = "DebugOverlay"
	_debug_overlay_root.z_index = DEBUG_OVERLAY_Z_INDEX
	_world_root.add_child(_debug_overlay_root)
	_build_debug_overlay(blueprint, navpoly)

func _spawn_decals(blueprint: Blueprint) -> void:

	for decal_data in blueprint.decals:
		var texture_path: String = str(decal_data["texture"]).strip_edges()
		var texture: Texture2D = load(texture_path)
		if texture == null:
			push_warning("[SceneRunner] Missing decal texture: %s" % texture_path)
			continue
		var sprite: Sprite2D = Sprite2D.new()
		sprite.name = str(decal_data["id"])
		sprite.texture = texture
		sprite.centered = false
		var decal_pos: Vector2 = decal_data["pos"]
		sprite.position = decal_pos
		var decal_size: Vector2 = decal_data["size"]
		if texture.get_size().x > 0 and texture.get_size().y > 0:
			var scale_x: float = decal_size.x / float(texture.get_size().x)
			var scale_y: float = decal_size.y / float(texture.get_size().y)
			sprite.scale = Vector2(scale_x, scale_y)
		sprite.z_index = int(decal_data["z_index"])
		_decals_root.add_child(sprite)

func _spawn_props(blueprint: Blueprint) -> void:
	for prop_data in blueprint.props:
		var bake_mode: String = str(prop_data.get("bake", "static")).strip_edges().to_lower()
		if bake_mode != "live":
			continue
		var def_path: String = str(prop_data["def"]).strip_edges()
		var def_resource: Resource = ResourceLoader.load(def_path)
		if def_resource == null or def_resource.get_script() != PROP_DEF_SCRIPT:
			push_warning("[SceneRunner] Invalid PropDef: %s" % def_path)
			continue
		var prop_def: PropDef = def_resource as PropDef
		if prop_def.prefab == null:
			push_warning("[SceneRunner] Missing prefab for %s" % def_path)
			continue
		var instance: Node = prop_def.prefab.instantiate()
		if instance == null or not (instance is Node2D):
			push_warning("[SceneRunner] Prefab root must be Node2D: %s" % def_path)
			continue
		var prop_node: Node2D = instance
		prop_node.position = prop_data["pos"]
		if instance is PropInstance:
			var prop_instance: PropInstance = instance
			prop_instance.variant = int(prop_data.get("variant", 0))
		_y_sort_root.add_child(prop_node)

		if prop_def.has_overhang and instance is PropInstance:
			var prop_instance: PropInstance = instance
			var overhang: Node = prop_instance.extract_overhang_node()
			if overhang != null and overhang.get_parent() != null:
				var overhang_pos: Vector2 = overhang.global_position
				overhang.get_parent().remove_child(overhang)
				_overhang_root.add_child(overhang)
				if overhang is CanvasItem:
					var canvas_item: CanvasItem = overhang
					canvas_item.z_index = OVERHANG_Z_INDEX
				overhang.global_position = overhang_pos

func _spawn_player(blueprint: Blueprint) -> void:
	var player_scene: PackedScene = load("res://actors/Player.tscn")
	if player_scene == null:
		push_error("[SceneRunner] Missing Player.tscn")
		return
	_player = player_scene.instantiate() as Area2D
	_player.z_index = PLAYER_Z_INDEX
	_y_sort_root.add_child(_player)
	var spawn_pos: Vector2 = blueprint.player_spawn["pos"]
	_player.position = spawn_pos
	_player.set("walkmask", _walkmask)

func _spawn_npcs(blueprint: Blueprint) -> void:
	var npc_scene: PackedScene = load(NPC_SCENE_PATH)
	if npc_scene == null:
		push_warning("[SceneRunner] Missing NPC scene: %s" % NPC_SCENE_PATH)
		return
	for index in range(NPC_COUNT):
		var npc_node: Node = npc_scene.instantiate()
		if npc_node == null or not (npc_node is Node2D):
			continue
		var npc: Node2D = npc_node
		_y_sort_root.add_child(npc)
		var spawn_pos: Vector2 = blueprint.player_spawn["pos"]
		npc.position = spawn_pos + Vector2(60 * (index + 1), 30 * (index + 1))
		if npc.has_method("set_bounds"):
			npc.call("set_bounds", blueprint.size_px)

func _spawn_hotspots(blueprint: Blueprint) -> void:
	for hotspot in blueprint.hotspots:
		var area: Area2D = Area2D.new()
		area.name = str(hotspot["id"])
		area.set_meta("hotspot", hotspot)
		var collision: CollisionShape2D = CollisionShape2D.new()
		var circle: CircleShape2D = CircleShape2D.new()
		circle.radius = float(hotspot["radius"])
		collision.shape = circle
		area.add_child(collision)
		area.position = hotspot["pos"]
		area.area_entered.connect(_on_hotspot_entered.bind(area))
		_world_root.add_child(area)

func _spawn_exits(blueprint: Blueprint) -> void:
	for exit_data in blueprint.exits:
		var rect: Rect2 = exit_data["rect"]
		var width: float = rect.size.x
		var height: float = rect.size.y
		var area: Area2D = Area2D.new()
		area.name = str(exit_data["id"])
		var collision: CollisionShape2D = CollisionShape2D.new()
		var shape: RectangleShape2D = RectangleShape2D.new()
		shape.size = Vector2(width, height)
		collision.shape = shape
		area.add_child(collision)
		area.position = rect.position + rect.size * 0.5

		var marker: Polygon2D = Polygon2D.new()
		marker.color = DEBUG_EXIT_COLOR
		marker.z_index = DEBUG_EXIT_Z_INDEX
		marker.polygon = PackedVector2Array([
			Vector2(-width * 0.5, -height * 0.5),
			Vector2(width * 0.5, -height * 0.5),
			Vector2(width * 0.5, height * 0.5),
			Vector2(-width * 0.5, height * 0.5)
		])
		marker.visible = _debug_exit_markers
		marker.add_to_group("exit_marker")
		area.add_child(marker)

		var label: Label = Label.new()
		label.text = str(exit_data["id"])
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		label.position = Vector2(-width * 0.5, -height * 0.5)
		label.size = Vector2(width, height)
		label.clip_text = false
		var label_settings: LabelSettings = LabelSettings.new()
		label_settings.font_color = Color.WHITE
		label_settings.outline_color = Color.BLACK
		label_settings.outline_size = 4
		label_settings.font_size = 12
		label.label_settings = label_settings
		label.visible = _debug_exit_markers
		label.add_to_group("exit_marker")
		area.add_child(label)

		area.area_entered.connect(_on_exit_entered.bind(exit_data))
		_world_root.add_child(area)

func _build_debug_overlay(blueprint: Blueprint, navpoly: NavigationPolygon) -> void:
	if _debug_overlay_root == null:
		return
	_spawn_marker = Polygon2D.new()
	_spawn_marker.name = "SpawnMarker"
	_spawn_marker.color = DEBUG_SPAWN_COLOR
	_spawn_marker.z_index = DEBUG_OVERLAY_Z_INDEX
	var half_size: float = DEBUG_SPAWN_SIZE * 0.5
	_spawn_marker.polygon = PackedVector2Array([
		Vector2(-half_size, -half_size),
		Vector2(half_size, -half_size),
		Vector2(half_size, half_size),
		Vector2(-half_size, half_size)
	])
	_spawn_marker.position = blueprint.player_spawn["pos"]
	_debug_overlay_root.add_child(_spawn_marker)

	_nav_overlay_root = Node2D.new()
	_nav_overlay_root.name = "NavOverlay"
	_debug_overlay_root.add_child(_nav_overlay_root)
	if navpoly != null:
		_build_nav_overlay(navpoly)

	_apply_debug_visuals()

func _build_nav_overlay(navpoly: NavigationPolygon) -> void:
	if _nav_overlay_root == null:
		return
	var outline_count: int = navpoly.get_outline_count()
	for index in range(outline_count):
		var outline: PackedVector2Array = navpoly.get_outline(index)
		var poly: Polygon2D = Polygon2D.new()
		poly.polygon = outline
		poly.color = DEBUG_NAV_COLOR
		poly.z_index = DEBUG_OVERLAY_Z_INDEX
		_nav_overlay_root.add_child(poly)

func _build_walkmask_overlay(path: String) -> void:
	if _debug_overlay_root == null:
		return
	var texture: Texture2D = load(path)
	if texture == null:
		push_warning("[SceneRunner] Missing walkmask texture: %s" % path)
		return
	_walkmask_overlay = Sprite2D.new()
	_walkmask_overlay.name = "WalkmaskOverlay"
	_walkmask_overlay.texture = texture
	_walkmask_overlay.centered = false
	_walkmask_overlay.position = Vector2.ZERO
	_walkmask_overlay.modulate = DEBUG_WALKMASK_COLOR
	_walkmask_overlay.z_index = DEBUG_OVERLAY_Z_INDEX
	_debug_overlay_root.add_child(_walkmask_overlay)
	_update_walkmask_overlay()

func _load_texture(path: String, label: String) -> Texture2D:
	if path == "":
		return null
	var texture: Texture2D = load(path)
	if texture == null:
		push_warning("[SceneRunner] Missing %s texture: %s" % [label, path])
	return texture

func _toggle_debug_visuals() -> void:
	_debug_visuals = not _debug_visuals
	var state: String = "on" if _debug_visuals else "off"
	_set_debug_text("Debug visuals: %s" % state)
	_apply_debug_visuals()

func _apply_debug_visuals() -> void:
	_update_exit_marker_visibility()
	_update_walkmask_overlay()
	_update_nav_overlay()
	_update_spawn_marker_visibility()
	if _debug_label != null:
		_debug_label.visible = _debug_visuals

func _activate_clean_screenshot() -> void:
	_debug_visuals = false
	_debug_exit_markers = false
	_debug_walkmask = false
	_debug_nav = false
	_update_exit_marker_visibility()
	_update_walkmask_overlay()
	_update_nav_overlay()
	_update_spawn_marker_visibility()
	if _debug_label != null:
		_debug_label.visible = false
	_set_debug_text("Screenshot mode")

func _update_spawn_marker_visibility() -> void:
	if _spawn_marker == null:
		return
	_spawn_marker.visible = _debug_visuals

func _update_walkmask_overlay() -> void:
	if _walkmask_overlay == null:
		return
	_walkmask_overlay.visible = _debug_visuals and _debug_walkmask

func _update_nav_overlay() -> void:
	if _nav_overlay_root == null:
		return
	_nav_overlay_root.visible = _debug_visuals and _debug_nav

func _on_hotspot_entered(entered: Area2D, area: Area2D) -> void:
	if entered != _player:
		return
	var data: Dictionary = area.get_meta("hotspot")
	var text: String = ""
	if data.has("text"):
		text = str(data["text"])
	print("[Hotspot] %s" % text)
	_set_debug_text(text)

func _on_exit_entered(entered: Area2D, exit_data: Dictionary) -> void:
	if entered != _player:
		return
	var target: Dictionary = exit_data["target"]
	var target_scene: String = str(target["scene_id"])
	print("[Exit] Switching to %s" % target_scene)
	load_scene(target_scene)

func _update_exit_marker_visibility() -> void:
	for marker in get_tree().get_nodes_in_group("exit_marker"):
		if marker is CanvasItem:
			var item: CanvasItem = marker
			item.visible = _debug_visuals and _debug_exit_markers

func _update_overhang_visibility() -> void:
	if _overhang_root == null:
		return
	_overhang_root.visible = _debug_overhangs

func _update_decal_visibility() -> void:
	if _decals_root == null:
		return
	_decals_root.visible = _debug_decals

func _set_debug_text(text: String) -> void:
	if _debug_label == null:
		return
	_debug_label.text = text
