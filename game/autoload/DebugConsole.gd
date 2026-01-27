extends Node

signal command_executed(command: String, args: Array, result: String)

var _console_visible := false
var _console_ui: CanvasLayer = null
var _cheats_enabled := false
var godmode_enabled := false

const COMMANDS := {
	"help": "_cmd_help",
	"spawn": "_cmd_spawn",
	"teleport": "_cmd_teleport",
	"heal": "_cmd_heal",
	"give_tool": "_cmd_give_tool",
	"give_item": "_cmd_give_item",
	"set_flag": "_cmd_set_flag",
	"set_time": "_cmd_set_time",
	"set_weather": "_cmd_set_weather",
	"fps": "_cmd_fps",
	"reload_data": "_cmd_reload_data",
	"godmode": "_cmd_godmode",
	"goto": "_cmd_goto",
	"cheats": "_cmd_cheats",
}

func _ready() -> void:
	if OS.has_feature("release"):
		_cheats_enabled = false
		print("[DebugConsole] Cheats disabled (release build)")
	else:
		_cheats_enabled = true
	_create_console_ui()
	print("[DebugConsole] Initialized")

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("debug_console"):
		toggle_console()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_QUOTELEFT:
		toggle_console()
		get_viewport().set_input_as_handled()

func toggle_console() -> void:
	_console_visible = not _console_visible
	if _console_ui:
		_console_ui.visible = _console_visible
		if _console_visible:
			var input_field = _console_ui.get_node_or_null("Panel/InputField")
			if input_field:
				input_field.grab_focus()

func show_console() -> void:
	_console_visible = true
	if _console_ui:
		_console_ui.visible = true
		var input_field = _console_ui.get_node_or_null("Panel/InputField")
		if input_field:
			input_field.grab_focus()

func hide_console() -> void:
	_console_visible = false
	if _console_ui:
		_console_ui.visible = false

func is_visible() -> bool:
	return _console_visible

func execute_command(input: String) -> String:
	var parts := input.strip_edges().split(" ", false)
	if parts.is_empty():
		return ""
	
	var cmd := parts[0].to_lower()
	var args: Array = []
	for i in range(1, parts.size()):
		args.append(parts[i])
	
	if not COMMANDS.has(cmd):
		var result := "Unknown command: %s. Type 'help' for commands." % cmd
		_log_output(result)
		return result
	
	var method_name: String = COMMANDS[cmd]
	var result: String = call(method_name, args)
	_log_output(result)
	command_executed.emit(cmd, args, result)
	return result

func _log_output(text: String) -> void:
	print("[DebugConsole] %s" % text)
	if _console_ui:
		var output_label = _console_ui.get_node_or_null("Panel/OutputLabel")
		if output_label:
			output_label.text = text

func _cmd_help(_args: Array) -> String:
	var cmds := COMMANDS.keys()
	cmds.sort()
	return "Commands: " + ", ".join(cmds)

func _cmd_spawn(args: Array) -> String:
	if args.is_empty():
		return "Usage: spawn <enemy_id>"
	var enemy_id: String = args[0]
	var enemy_data: Dictionary = GameData.get_enemy(enemy_id)
	if enemy_data.is_empty():
		return "Unknown enemy: %s" % enemy_id
	return "Spawned enemy: %s (stub - no scene spawning)" % enemy_id

func _cmd_teleport(args: Array) -> String:
	if args.size() < 2:
		return "Usage: teleport <x> <y>"
	var x := float(args[0])
	var y := float(args[1])
	var player := get_tree().get_first_node_in_group("player")
	if player and player.has_method("set_position"):
		player.position = Vector2(x, y)
		return "Teleported to (%d, %d)" % [int(x), int(y)]
	return "No player found"

func _cmd_heal(args: Array) -> String:
	var all_state: Dictionary = PartyManager.get_all_state()
	if all_state.is_empty():
		return "No party members"
	
	var healed_count := 0
	for member_id in all_state.keys():
		var member: Dictionary = all_state[member_id]
		if member.has("max_hp"):
			var max_hp: int = member["max_hp"]
			PartyManager.load_state({member_id: {"current_hp": max_hp, "current_mp": member.get("max_mp", 0)}})
			healed_count += 1
	
	return "Healed %d party member(s)" % healed_count

func _cmd_give_tool(args: Array) -> String:
	if args.is_empty():
		return "Usage: give_tool <tool_id>"
	var tool_id: String = args[0]
	InventoryManager.acquire_tool(tool_id)
	return "Gave tool: %s" % tool_id

func _cmd_give_item(args: Array) -> String:
	if args.size() < 1:
		return "Usage: give_item <item_id> [count]"
	var item_id: String = args[0]
	var count := 1
	if args.size() >= 2:
		count = int(args[1])
	InventoryManager.add_item(item_id, count)
	return "Gave %d x %s" % [count, item_id]

func _cmd_set_flag(args: Array) -> String:
	if args.size() < 2:
		return "Usage: set_flag <flag> <true|false>"
	var flag: String = args[0]
	var value: bool = args[1].to_lower() == "true"
	InventoryManager.set_story_flag(flag, value)
	return "Set flag %s = %s" % [flag, value]

func _cmd_set_time(args: Array) -> String:
	if args.is_empty():
		return "Usage: set_time <0-3> (0=morning, 1=afternoon, 2=evening, 3=night)"
	var phase := int(args[0])
	if phase < 0 or phase > 3:
		return "Phase must be 0-3"
	DayNightManager.set_time_phase(phase)
	return "Set time phase to %d" % phase

func _cmd_set_weather(args: Array) -> String:
	if args.is_empty():
		return "Usage: set_weather <0-2> (0=clear, 1=rain, 2=storm)"
	var weather := int(args[0])
	if weather < 0 or weather > 2:
		return "Weather must be 0-2"
	WeatherManager.set_weather(weather)
	return "Set weather to %d" % weather

func _cmd_fps(_args: Array) -> String:
	var fps := Engine.get_frames_per_second()
	return "FPS: %d" % fps

func _cmd_reload_data(_args: Array) -> String:
	GameData.reload_all()
	return "Reloaded all game data"

func _create_console_ui() -> void:
	_console_ui = CanvasLayer.new()
	_console_ui.layer = 100
	_console_ui.visible = false
	add_child(_console_ui)
	
	var panel := Panel.new()
	panel.name = "Panel"
	panel.set_anchors_preset(Control.PRESET_TOP_WIDE)
	panel.custom_minimum_size = Vector2(0, 80)
	panel.size = Vector2(512, 80)
	_console_ui.add_child(panel)
	
	var output_label := Label.new()
	output_label.name = "OutputLabel"
	output_label.position = Vector2(8, 4)
	output_label.size = Vector2(496, 20)
	output_label.text = "Type 'help' for commands"
	panel.add_child(output_label)
	
	var input_field := LineEdit.new()
	input_field.name = "InputField"
	input_field.position = Vector2(8, 32)
	input_field.size = Vector2(496, 32)
	input_field.placeholder_text = "Enter command..."
	input_field.text_submitted.connect(_on_command_submitted)
	panel.add_child(input_field)

func _on_command_submitted(text: String) -> void:
	if _console_ui:
		var input_field = _console_ui.get_node_or_null("Panel/InputField")
		if input_field:
			input_field.text = ""
	execute_command(text)

func _cmd_godmode(_args: Array) -> String:
	if not _cheats_enabled:
		return "Cheats disabled in release builds"
	godmode_enabled = not godmode_enabled
	return "God mode: %s" % ("ON" if godmode_enabled else "OFF")

func _cmd_goto(args: Array) -> String:
	if not _cheats_enabled:
		return "Cheats disabled in release builds"
	if args.is_empty():
		return "Usage: goto <area_name> (e.g., town_center, hero_house, forest_entrance)"
	
	var area_name: String = args[0].to_lower()
	var scene_map := {
		"town_center": "res://game/scenes/areas/Area_TownCenter.tscn",
		"hero_house": "res://game/scenes/areas/Area_HeroHouse.tscn",
		"hero_house_interior": "res://game/scenes/areas/Area_HeroHouseInterior.tscn",
		"school": "res://game/scenes/areas/Area_School.tscn",
		"arcade": "res://game/scenes/areas/Area_Arcade.tscn",
		"town_park": "res://game/scenes/areas/Area_TownPark.tscn",
		"forest_entrance": "res://game/scenes/areas/Area_ForestEntrance.tscn",
		"forest_path": "res://game/scenes/areas/Area_ForestPath.tscn",
		"bubblegum_bay": "res://game/scenes/areas/Area_BubblegumBay.tscn",
		"pinecone_pass": "res://game/scenes/areas/Area_PineconePass.tscn",
		"enchanted_forest": "res://game/scenes/areas/Area_EnchantedForest.tscn",
	}
	
	if not scene_map.has(area_name):
		return "Unknown area: %s. Available: %s" % [area_name, ", ".join(scene_map.keys())]
	
	var scene_path: String = scene_map[area_name]
	SceneRouter.go_to_area(scene_path, "default")
	return "Warping to %s..." % area_name

func _cmd_cheats(_args: Array) -> String:
	if OS.has_feature("release"):
		return "Cheats disabled in release builds"
	return "Cheats: %s" % ("enabled" if _cheats_enabled else "disabled")

func is_godmode_enabled() -> bool:
	return godmode_enabled and _cheats_enabled
