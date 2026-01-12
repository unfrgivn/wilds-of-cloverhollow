extends Node
class_name SceneRunner

const DEFAULT_SCENE_ID: String = "town_square_01"
const PLAYER_Z_INDEX: int = 2
const OVERHANG_Z_INDEX: int = 50
const DEBUG_EXIT_COLOR: Color = Color(0.0, 1.0, 1.0, 0.3)
const DEBUG_EXIT_Z_INDEX: int = 100
const DECAL_Z_INDEX: int = -5
const DEBUG_TOGGLE_KEY: Key = KEY_F2
const DEBUG_OVERHANG_TOGGLE_KEY: Key = KEY_F3
const DEBUG_DECAL_TOGGLE_KEY: Key = KEY_F4
const NPC_SCENE_PATH: String = "res://actors/NpcAgent.tscn"
const NPC_COUNT: int = 2

const PROP_DEF_SCRIPT: Script = preload("res://game/props/prop_def.gd")

var _debug_exit_markers: bool = true
var _debug_overhangs: bool = true
var _debug_decals: bool = true

var _scene_root: Node2D
var _debug_label: Label
var _walkmask: WalkMask
var _player: Area2D
var _world_root: Node2D
var _y_sort_root: Node2D
var _overhang_root: Node2D
var _nav_region: NavigationRegion2D
var _decals_root: Node2D

func _ready() -> void:
	var parent_node: Node = get_parent()
	_scene_root = parent_node.get_node("SceneRoot") as Node2D
	var ui_node: Node = parent_node.get_node("UI")
	_debug_label = ui_node.get_node_or_null("DebugLabel") as Label
	load_scene(DEFAULT_SCENE_ID)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var key_event: InputEventKey = event
		if key_event.keycode == DEBUG_TOGGLE_KEY:
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
	_spawn_decals(blueprint)
	_spawn_props(blueprint)
	_spawn_player(blueprint)

	_spawn_npcs(blueprint)
	_spawn_hotspots(blueprint)
	_spawn_exits(blueprint)
	_set_debug_text("Loaded scene: %s" % scene_id)
	print("[SceneRunner] Loaded scene: %s" % scene_id)

func _clear_scene_root() -> void:
	for child in _scene_root.get_children():
		_scene_root.remove_child(child)
		child.queue_free()

func _build_world(blueprint: Blueprint) -> void:
	_world_root = Node2D.new()
	_world_root.name = "World"
	_scene_root.add_child(_world_root)

	var ground: Sprite2D = Sprite2D.new()
	ground.name = "Ground"
	ground.texture = load(blueprint.assets["ground"])
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

	_decals_root = Node2D.new()
	_decals_root.name = "DecalsRoot"
	_decals_root.z_index = DECAL_Z_INDEX
	_decals_root.visible = _debug_decals
	_world_root.add_child(_decals_root)

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
			item.visible = _debug_exit_markers

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
