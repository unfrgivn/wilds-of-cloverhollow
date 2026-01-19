extends Node

var scenario_id := ""
var capture_dir := ""
var seed_value := 0
var quit_after_frames := 0
var frames_elapsed := 0
var trace: Dictionary = {}
var _default_physics_ticks := 0

@export var fixed_physics_ticks := 60

@onready var _dialogue_manager = get_node("/root/DialogueManager")


func _ready() -> void:
	_parse_args()
	if scenario_id.is_empty():
		return
	call_deferred("_run_scenario")


func has_pending_scenario() -> bool:
	return not scenario_id.is_empty()


func _parse_args() -> void:
	var args = OS.get_cmdline_user_args()
	var i = 0

	while i < args.size():
		var arg = args[i]
		if arg.begins_with("--scenario="):
			scenario_id = arg.get_slice("=", 1)
		elif arg == "--scenario" and i + 1 < args.size():
			scenario_id = args[i + 1]
			i += 1
		elif arg.begins_with("--capture_dir="):
			capture_dir = arg.get_slice("=", 1)
		elif arg == "--capture_dir" and i + 1 < args.size():
			capture_dir = args[i + 1]
			i += 1
		elif arg.begins_with("--seed="):
			seed_value = int(arg.get_slice("=", 1))
		elif arg == "--seed" and i + 1 < args.size():
			seed_value = int(args[i + 1])
			i += 1
		elif arg.begins_with("--quit_after_frames="):
			quit_after_frames = int(arg.get_slice("=", 1))
		elif arg == "--quit_after_frames" and i + 1 < args.size():
			quit_after_frames = int(args[i + 1])
			i += 1
		i += 1


func _run_scenario() -> void:
	var scenario = _load_scenario(scenario_id)
	if scenario.is_empty():
		push_error("Scenario not found: %s" % scenario_id)
		get_tree().quit()
		return

	if seed_value == 0 and scenario.has("seed"):
		seed_value = int(scenario["seed"])
	if seed_value != 0:
		seed(seed_value)

	_default_physics_ticks = Engine.physics_ticks_per_second
	if fixed_physics_ticks > 0:
		Engine.physics_ticks_per_second = fixed_physics_ticks
	Engine.max_physics_steps_per_frame = 1

	if capture_dir.is_empty():
		capture_dir = "captures/%s/%s" % [scenario_id, Time.get_datetime_string_from_system().replace(":", "-")]

	trace = {
		"scenario_id": scenario_id,
		"seed": seed_value,
		"events": [],
	}

	var start_scene = String(scenario.get("start_scene", ""))
	if start_scene.is_empty():
		push_error("Scenario missing start_scene")
		get_tree().quit()
		return

	get_tree().change_scene_to_file(start_scene)
	await get_tree().process_frame
	await get_tree().process_frame

	var actions: Array = scenario.get("actions", [])
	for action in actions:
		await _execute_action(action)
		if _should_quit():
			break

	_write_trace()
	if _default_physics_ticks > 0:
		Engine.physics_ticks_per_second = _default_physics_ticks
	get_tree().quit()


func _execute_action(action: Dictionary) -> void:
	var action_type = String(action.get("type", ""))
	if action_type == "wait_frames":
		await _wait_frames(int(action.get("frames", 1)))
		return
	if action_type == "move_to":
		await _move_to(action)
		return
	if action_type == "interact":
		await _interact(action)
		return
	if action_type == "trigger_encounter":
		await _trigger_encounter(action)
		return
	if action_type == "select_battle_command":
		await _select_battle_command(action)
		return
	if action_type == "capture" or action_type == "capture_checkpoint":
		_capture_checkpoint(String(action.get("label", "checkpoint")))
		return

	_record_event("unknown_action", {"type": action_type})


func _wait_frames(frame_count: int) -> void:
	var frames = max(frame_count, 0)
	for i in range(frames):
		await _step_frame()
		if _should_quit():
			return


func _step_frame() -> void:
	await get_tree().physics_frame
	frames_elapsed += 1


func _move_to(action: Dictionary) -> void:
	var target_x = float(action.get("x", 0.0))
	var target_z = float(action.get("z", 0.0))
	var tolerance = float(action.get("tolerance", 0.2))
	var timeout_frames = int(action.get("timeout_frames", 600))
	var player = _find_player()

	if player == null:
		_record_event("move_to_failed", {"reason": "player_missing"})
		return

	var player_node: Node3D = player
	var player_controller = player
	var target = Vector3(target_x, player_node.global_position.y, target_z)
	var frames = 0

	while frames < timeout_frames:
		var delta = target - player_node.global_position
		var planar = Vector2(delta.x, delta.z)
		if planar.length() <= tolerance:
			break

		var direction = planar.normalized()
		if player_controller.has_method("set_scenario_input"):
			player_controller.set_scenario_input(direction)

		await _step_frame()
		frames += 1
		if _should_quit():
			break

	if player_controller.has_method("clear_scenario_input"):
		player_controller.clear_scenario_input()

	_record_event("move_to", {"x": target_x, "z": target_z, "frames": frames})


func _interact(action: Dictionary) -> void:
	var player = _find_player()
	if player == null:
		_record_event("interact_failed", {"reason": "player_missing"})
		return

	if _dialogue_manager != null and _dialogue_manager.is_active:
		_dialogue_manager.advance()
		_record_event("interact", {"mode": "dialogue"})
		await _wait_frames(1)
		return

	var target_name = String(action.get("target", ""))
	if not target_name.is_empty():
		var target = _find_node_by_name(target_name)
		if target != null and target.has_method("interact"):
			target.interact(player)
			_record_event("interact", {"target": target_name})
			await _wait_frames(1)
			return

	if player.has_method("try_interact"):
		var success = player.try_interact()
		_record_event("interact", {"success": success})
		await _wait_frames(1)
		return

	_record_event("interact_failed", {"reason": "no_interaction_handler"})

func _trigger_encounter(action: Dictionary) -> void:
	var target_name = String(action.get("target", ""))
	var target = null
	if not target_name.is_empty():
		target = _find_node_by_name(target_name)
	if target != null and target.has_method("trigger_encounter"):
		target.trigger_encounter()
		_record_event("trigger_encounter", {"target": target_name})
		await _wait_frames(1)
		return
	_record_event("trigger_encounter_failed", {"target": target_name})

func _select_battle_command(action: Dictionary) -> void:
	var command_id = String(action.get("command", "attack"))
	var target_name = String(action.get("target", ""))
	var target = null
	if not target_name.is_empty():
		target = _find_node_by_name(target_name)
	if target == null:
		target = get_tree().current_scene
	if target != null and target.has_method("select_battle_command"):
		target.select_battle_command(command_id)
		_record_event("select_battle_command", {"command": command_id})
		await _wait_frames(int(action.get("wait_frames", 1)))
		return
	_record_event("select_battle_command_failed", {"command": command_id})

func _find_node_by_name(node_name: String) -> Node:
	var root = get_tree().current_scene
	if root == null:
		return null
	if root.name == node_name:
		return root
	return root.find_child(node_name, true, false)

func _capture_checkpoint(label: String) -> void:
	if DisplayServer.get_name() == "headless":
		_record_event("capture", {"label": label, "path": "", "skipped": true})
		return
	var resolved = _resolve_capture_dir(capture_dir)
	var safe_label = _sanitize_label(label)
	var frame_path = "%s/frames/%s_%04d.png" % [resolved, safe_label, frames_elapsed]
	DirAccess.make_dir_recursive_absolute(frame_path.get_base_dir())
	var viewport = get_viewport()
	if viewport != null:
		var texture = viewport.get_texture()
		if texture != null and texture.get_rid().is_valid():
			var image = texture.get_image()
			if image != null:
				image.save_png(frame_path)
				_record_event("capture", {"label": label, "path": frame_path})
				return
	_record_event("capture", {"label": label, "path": "", "skipped": true})


func _sanitize_label(label: String) -> String:
	var sanitized = label.strip_edges().to_lower()
	sanitized = sanitized.replace(" ", "_")
	sanitized = sanitized.replace("/", "_")
	return sanitized


func _record_event(event_type: String, data: Dictionary = {}) -> void:
	var entry = {
		"frame": frames_elapsed,
		"type": event_type,
	}
	for key in data.keys():
		entry[key] = data[key]
	trace["events"].append(entry)


func _find_player() -> Node:
	var root = get_tree().current_scene
	if root == null:
		return null
	var candidate = root.get_node_or_null("Player")
	if candidate != null:
		return candidate
	return root.find_child("Player", true, false)


func _should_quit() -> bool:
	return quit_after_frames > 0 and frames_elapsed >= quit_after_frames


func _load_scenario(id: String) -> Dictionary:
	var path = "res://tests/scenarios/%s.json" % id
	if not FileAccess.file_exists(path):
		return {}

	var file = FileAccess.open(path, FileAccess.READ)
	var content = file.get_as_text()
	var parsed = JSON.parse_string(content)
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed


func _write_trace() -> void:
	if trace.is_empty():
		return

	var resolved = _resolve_capture_dir(capture_dir)
	DirAccess.make_dir_recursive_absolute(resolved)
	var trace_path = "%s/trace.json" % resolved
	var file = FileAccess.open(trace_path, FileAccess.WRITE)
	file.store_string(JSON.stringify(trace, "\t"))


func _resolve_capture_dir(dir: String) -> String:
	if dir.begins_with("res://") or dir.begins_with("user://"):
		return ProjectSettings.globalize_path(dir)
	if dir.is_absolute_path():
		return dir
	return ProjectSettings.globalize_path("res://" + dir)
