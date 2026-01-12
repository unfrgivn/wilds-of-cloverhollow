extends SceneTree

const SCENES_ROOT: String = "res://content/scenes"
const LAYOUT_NAME: String = "layout.tscn"
const BAKED_DIR: String = "_baked"
const WALKMASK_RAW: String = "walkmask_raw.png"
const WALKMASK_PLAYER: String = "walkmask_player.png"
const NAVPOLY_PATH: String = "navpoly.tres"

const LAYOUT_ROOT_SCRIPT: Script = preload("res://game/tools/layout_root.gd")
const SPAWN_MARKER_SCRIPT: Script = preload("res://game/tools/markers/spawn_marker_2d.gd")
const HOTSPOT_MARKER_SCRIPT: Script = preload("res://game/tools/markers/hotspot_marker_2d.gd")
const EXIT_MARKER_SCRIPT: Script = preload("res://game/tools/markers/exit_marker_2d.gd")
const DECAL_MARKER_SCRIPT: Script = preload("res://game/tools/markers/decal_marker_2d.gd")
const PROP_INSTANCE_SCRIPT: Script = preload("res://game/props/prop_instance.gd")

var _had_failure: bool = false

func _init() -> void:
	var scene_ids: Array[String] = _find_scene_ids()
	if scene_ids.is_empty():
		push_warning("[Export] No scenes found under %s" % SCENES_ROOT)
		quit(0)
		return
	for scene_id in scene_ids:
		_export_scene(scene_id)
	quit(1 if _had_failure else 0)

func _find_scene_ids() -> Array[String]:
	var dir: DirAccess = DirAccess.open(SCENES_ROOT)
	if dir == null:
		push_error("[Export] Missing scenes root: %s" % SCENES_ROOT)
		_had_failure = true
		return []
	var names: Array[String] = []
	dir.list_dir_begin()
	var entry: String = dir.get_next()
	while entry != "":
		if dir.current_is_dir() and not entry.begins_with("."):
			names.append(entry)
		entry = dir.get_next()
	dir.list_dir_end()
	names.sort()
	return names

func _export_scene(scene_id: String) -> void:
	var scene_folder: String = SCENES_ROOT.path_join(scene_id)
	var layout_path: String = scene_folder.path_join(LAYOUT_NAME)
	if not FileAccess.file_exists(layout_path):
		push_warning("[Export] No layout.tscn for %s" % scene_id)
		return
	var packed: PackedScene = load(layout_path) as PackedScene
	if packed == null:
		push_error("[Export] Failed to load %s" % layout_path)
		_had_failure = true
		return
	var instance: Node = packed.instantiate()
	get_root().add_child(instance)
	var layout_root: Node = _find_layout_root(instance)
	if layout_root == null:
		push_error("[Export] LayoutRoot missing in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return
	var scene_id_value: String = str(layout_root.get("scene_id"))
	if scene_id_value.strip_edges() == "":
		push_error("[Export] LayoutRoot.scene_id missing in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return
	var default_spawn_id: String = str(layout_root.get("default_spawn_id"))
	var base_walkmask_path: String = str(layout_root.get("base_walkmask_path")).strip_edges()

	var ground_sprite: Sprite2D = layout_root.get_node_or_null("Ground") as Sprite2D
	if ground_sprite == null:
		push_error("[Export] Missing Ground Sprite2D in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return
	if ground_sprite.texture == null:
		push_error("[Export] Ground texture missing in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return
	if ground_sprite.texture.resource_path == "":
		push_error("[Export] Ground texture must be saved to disk in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return
	var ground_size: Vector2i = Vector2i(int(ground_sprite.texture.get_width()), int(ground_sprite.texture.get_height()))
	if ground_size.x <= 0 or ground_size.y <= 0:
		push_error("[Export] Ground texture has invalid size in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return

	var spawn_marker: Node = _find_spawn_marker(layout_root, default_spawn_id)
	if spawn_marker == null:
		push_error("[Export] No SpawnMarker2D found in %s" % layout_path)
		_had_failure = true
		instance.queue_free()
		return
	var spawn_id: String = str(spawn_marker.get("spawn_id"))
	var spawn_pos: Vector2i = _round_vector2((spawn_marker as Node2D).global_position)

	var props: Array[Dictionary] = _collect_props(layout_root)
	if _had_failure:
		instance.queue_free()
		return
	props.sort_custom(_sort_props)

	var decals: Array[Dictionary] = _collect_decals(layout_root)
	if _had_failure:
		instance.queue_free()
		return
	decals.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return str(a["id"]) < str(b["id"]))

	var hotspots: Array[Dictionary] = _collect_hotspots(layout_root)
	if _had_failure:
		instance.queue_free()
		return
	hotspots.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return str(a["id"]) < str(b["id"]))

	var exits: Array[Dictionary] = _collect_exits(layout_root)
	if _had_failure:
		instance.queue_free()
		return
	exits.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return str(a["id"]) < str(b["id"]))

	var assets: Dictionary = {}
	assets["ground"] = ground_sprite.texture.resource_path
	if base_walkmask_path != "":
		assets["base_walkmask"] = base_walkmask_path
	assets["walkmask_raw"] = scene_folder.path_join(BAKED_DIR).path_join(WALKMASK_RAW)
	assets["walkmask_player"] = scene_folder.path_join(BAKED_DIR).path_join(WALKMASK_PLAYER)
	assets["navpoly"] = scene_folder.path_join(BAKED_DIR).path_join(NAVPOLY_PATH)

	var data: Dictionary = {
		"scene_id": scene_id_value,
		"size_px": [ground_size.x, ground_size.y],
		"assets": assets,
		"player_spawn": {
			"id": spawn_id,
			"pos": [spawn_pos.x, spawn_pos.y]
		},
		"props": props,
		"decals": decals,
		"hotspots": hotspots,
		"exits": exits
	}

	var json_text: String = JSON.stringify(data, "  ", false)
	var output_path: String = scene_folder.path_join("scene.json")
	var file: FileAccess = FileAccess.open(output_path, FileAccess.WRITE)
	if file == null:
		push_error("[Export] Failed to write %s" % output_path)
		_had_failure = true
		instance.queue_free()
		return
	file.store_string(json_text)
	file.close()
	print("[Export] Exported %s -> %s (props=%d hotspots=%d exits=%d)" % [
		scene_id_value,
		output_path,
		props.size(),
		hotspots.size(),
		exits.size()
	])
	instance.queue_free()

func _find_layout_root(root: Node) -> Node:
	if _node_has_script(root, LAYOUT_ROOT_SCRIPT):
		return root
	var children: Array = root.get_children()
	children.sort_custom(func(a: Node, b: Node) -> bool:
		return a.name < b.name)
	for child in children:
		var found: Node = _find_layout_root(child)
		if found != null:
			return found
	return null

func _collect_props(layout_root: Node) -> Array[Dictionary]:
	var props: Array[Dictionary] = []
	var nodes: Array[Node] = _collect_nodes_with_script(layout_root, PROP_INSTANCE_SCRIPT)
	for node in nodes:
		if not (node is Node2D):
			push_error("[Export] Prop instance must be Node2D: %s" % node.name)
			_had_failure = true
			return []
		var prop_node: Node2D = node
		var prop_def: Resource = prop_node.get("prop_def") as Resource
		if prop_def == null:
			push_error("[Export] Prop missing prop_def on %s" % prop_node.name)
			_had_failure = true
			return []
		if prop_def.resource_path == "":
			push_error("[Export] PropDef must be saved for %s" % prop_node.name)
			_had_failure = true
			return []
		var pos: Vector2i = _round_vector2(prop_node.global_position)
		var variant_value: Variant = prop_node.get("variant")
		var variant: int = 0
		if typeof(variant_value) == TYPE_INT:
			variant = int(variant_value)
		props.append({
			"def": prop_def.resource_path,
			"pos": [pos.x, pos.y],
			"variant": variant
		})
	return props

func _collect_decals(layout_root: Node) -> Array[Dictionary]:
	var decals: Array[Dictionary] = []
	var nodes: Array[Node] = _collect_nodes_with_script(layout_root, DECAL_MARKER_SCRIPT)
	for node in nodes:
		if not (node is Node2D):
			push_error("[Export] Decal marker must be Node2D: %s" % node.name)
			_had_failure = true
			return []
		var marker: Node2D = node
		var decal_id: String = str(marker.get("decal_id")).strip_edges()
		if decal_id == "":
			push_error("[Export] Decal id missing on %s" % marker.name)
			_had_failure = true
			return []
		var texture_path: String = str(marker.get("texture_path")).strip_edges()
		if texture_path == "":
			push_error("[Export] Decal texture_path missing on %s" % marker.name)
			_had_failure = true
			return []
		var size: Vector2i = marker.get("size_px")
		if size.x <= 0 or size.y <= 0:
			push_error("[Export] Decal size_px invalid on %s" % marker.name)
			_had_failure = true
			return []
		var pos: Vector2i = _round_vector2(marker.global_position)
		var decal_z_index: int = int(marker.get("decal_z_index"))
		decals.append({
			"id": decal_id,
			"texture": texture_path,
			"pos": [pos.x, pos.y],
			"size": [size.x, size.y],
			"z_index": decal_z_index
		})
	return decals

func _collect_hotspots(layout_root: Node) -> Array[Dictionary]:
	var hotspots: Array[Dictionary] = []
	var nodes: Array[Node] = _collect_nodes_with_script(layout_root, HOTSPOT_MARKER_SCRIPT)
	for node in nodes:
		if not (node is Area2D):
			push_error("[Export] Hotspot marker must be Area2D: %s" % node.name)
			_had_failure = true
			return []
		var marker: Area2D = node
		var hotspot_id: String = str(marker.get("hotspot_id")).strip_edges()
		if hotspot_id == "":
			push_error("[Export] Hotspot id missing on %s" % marker.name)
			_had_failure = true
			return []
		var collision: CollisionShape2D = marker.get_node_or_null("CollisionShape2D") as CollisionShape2D
		if collision == null:
			push_error("[Export] Hotspot marker missing CollisionShape2D: %s" % marker.name)
			_had_failure = true
			return []
		var shape: CircleShape2D = collision.shape as CircleShape2D
		if shape == null:
			push_error("[Export] Hotspot marker shape must be CircleShape2D: %s" % marker.name)
			_had_failure = true
			return []
		var pos: Vector2i = _round_vector2(marker.global_position)
		hotspots.append({
			"id": hotspot_id,
			"type": str(marker.get("hotspot_type")),
			"pos": [pos.x, pos.y],
			"radius": int(round(shape.radius)),
			"text": str(marker.get("text"))
		})
	return hotspots

func _collect_exits(layout_root: Node) -> Array[Dictionary]:
	var exits: Array[Dictionary] = []
	var nodes: Array[Node] = _collect_nodes_with_script(layout_root, EXIT_MARKER_SCRIPT)
	for node in nodes:
		if not (node is Area2D):
			push_error("[Export] Exit marker must be Area2D: %s" % node.name)
			_had_failure = true
			return []
		var marker: Area2D = node
		var exit_id: String = str(marker.get("exit_id")).strip_edges()
		if exit_id == "":
			push_error("[Export] Exit id missing on %s" % marker.name)
			_had_failure = true
			return []
		var target_scene_id: String = str(marker.get("target_scene_id")).strip_edges()
		if target_scene_id == "":
			push_error("[Export] Exit target_scene_id missing on %s" % marker.name)
			_had_failure = true
			return []
		var collision: CollisionShape2D = marker.get_node_or_null("CollisionShape2D") as CollisionShape2D
		if collision == null:
			push_error("[Export] Exit marker missing CollisionShape2D: %s" % marker.name)
			_had_failure = true
			return []
		var shape: RectangleShape2D = collision.shape as RectangleShape2D
		if shape == null:
			push_error("[Export] Exit marker shape must be RectangleShape2D: %s" % marker.name)
			_had_failure = true
			return []
		var center: Vector2 = marker.global_position
		var width: float = shape.size.x
		var height: float = shape.size.y
		var x: int = int(round(center.x - width * 0.5))
		var y: int = int(round(center.y - height * 0.5))
		exits.append({
			"id": exit_id,
			"rect": [x, y, int(round(width)), int(round(height))],
			"target": {
				"scene_id": target_scene_id,
				"spawn_id": str(marker.get("target_spawn_id"))
			}
		})
	return exits

func _find_spawn_marker(layout_root: Node, default_id: String) -> Node:
	var markers: Array[Node] = _collect_nodes_with_script(layout_root, SPAWN_MARKER_SCRIPT)
	if markers.is_empty():
		return null
	for marker in markers:
		if str(marker.get("spawn_id")) == default_id:
			return marker
	return markers[0]

func _collect_nodes_with_script(root: Node, script_ref: Script) -> Array[Node]:
	var nodes: Array[Node] = []
	if _node_has_script(root, script_ref):
		nodes.append(root)
	var children: Array = root.get_children()
	children.sort_custom(func(a: Node, b: Node) -> bool:
		return a.name < b.name)
	for child in children:
		nodes.append_array(_collect_nodes_with_script(child, script_ref))
	return nodes

func _node_has_script(node: Node, script_ref: Script) -> bool:
	var node_script: Script = node.get_script()
	return node_script == script_ref

func _round_vector2(value: Vector2) -> Vector2i:
	return Vector2i(int(round(value.x)), int(round(value.y)))

func _sort_props(a: Dictionary, b: Dictionary) -> bool:
	var def_a: String = str(a["def"])
	var def_b: String = str(b["def"])
	if def_a == def_b:
		var pos_a: Array = a["pos"]
		var pos_b: Array = b["pos"]
		if int(pos_a[0]) == int(pos_b[0]):
			return int(pos_a[1]) < int(pos_b[1])
		return int(pos_a[0]) < int(pos_b[0])
	return def_a < def_b
