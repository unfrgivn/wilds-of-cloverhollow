extends Node
# Note: Do NOT add class_name here; it conflicts with the autoload singleton name.

# Minimal Scenario Runner scaffold.
# Implement full action set in later milestones.

var scenario_id: String = ""
var capture_dir: String = ""
var seed: int = 0
var quit_after_frames: int = 0

var _frame: int = 0
var _actions: Array = []
var _action_index: int = 0
var _wait_remaining: int = 0
var _move_remaining: int = 0
var _move_direction: String = ""
var _trace: Dictionary = {}

func _ready() -> void:
    # Ensure scenario runner continues to process even when game is paused
    process_mode = Node.PROCESS_MODE_ALWAYS
    
    var args := OS.get_cmdline_user_args()
    _parse_args(args)

    if scenario_id == "":
        set_process(false)
        return

    _trace = {
        "scenario_id": scenario_id,
        "seed": seed,
        "capture_dir": capture_dir,
        "started_at_unix": Time.get_unix_time_from_system(),
        "events": []
    }

    _load_scenario_file_if_exists()

    set_process(true)

func _process(_delta: float) -> void:
    if scenario_id == "":
        return

    _frame += 1

    _step_actions()

    if quit_after_frames > 0 and _frame >= quit_after_frames:
        _trace["ended_at_unix"] = Time.get_unix_time_from_system()
        _write_trace()
        get_tree().quit()

func _parse_args(args: PackedStringArray) -> void:
    # Expected args after `--`:
    # --scenario <id> --seed <int> --capture_dir <path> --quit_after_frames <int>
    var i := 0
    while i < args.size():
        var a := args[i]
        if a == "--scenario" and i + 1 < args.size():
            scenario_id = args[i + 1]
            i += 2
            continue
        if a == "--seed" and i + 1 < args.size():
            seed = int(args[i + 1])
            i += 2
            continue
        if a == "--capture_dir" and i + 1 < args.size():
            capture_dir = args[i + 1]
            i += 2
            continue
        if a == "--quit_after_frames" and i + 1 < args.size():
            quit_after_frames = int(args[i + 1])
            i += 2
            continue
        i += 1

func _load_scenario_file_if_exists() -> void:
    var path := "res://tests/scenarios/%s.json" % scenario_id
    if not FileAccess.file_exists(path):
        _trace["events"].append({"type": "info", "frame": _frame, "msg": "No scenario file found; running idle loop."})
        return

    var f := FileAccess.open(path, FileAccess.READ)
    var txt := f.get_as_text()
    f.close()

    var parsed = JSON.parse_string(txt)
    if typeof(parsed) != TYPE_DICTIONARY:
        _trace["events"].append({"type": "error", "frame": _frame, "msg": "Scenario JSON invalid."})
        return

    if parsed.has("actions") and typeof(parsed["actions"]) == TYPE_ARRAY:
        _actions = parsed["actions"]
        _trace["events"].append({"type": "info", "frame": _frame, "msg": "Loaded actions: %d" % _actions.size()})

    # Load custom scene if specified
    if parsed.has("scene") and typeof(parsed["scene"]) == TYPE_STRING:
        var scene_path: String = parsed["scene"]
        if scene_path != "":
            _trace["events"].append({"type": "info", "frame": _frame, "msg": "Loading scene: %s" % scene_path})
            # Use call_deferred to avoid issues with loading during _ready
            call_deferred("_load_starting_scene", scene_path)

func _load_starting_scene(scene_path: String) -> void:
    var result := get_tree().change_scene_to_file(scene_path)
    if result == OK:
        SceneRouter.current_area = scene_path
        _trace["events"].append({"type": "scene_loaded", "frame": _frame, "scene": scene_path})
    else:
        _trace["events"].append({"type": "error", "frame": _frame, "msg": "Failed to load scene: %s" % scene_path})

func _step_actions() -> void:
    if _action_index >= _actions.size():
        return

    var action = _actions[_action_index]
    if typeof(action) != TYPE_DICTIONARY or not action.has("type"):
        _trace["events"].append({"type": "error", "frame": _frame, "msg": "Action missing type."})
        _action_index += 1
        return

    var t: String = str(action["type"])

    if t == "load_scene":
        var scene_path := str(action.get("scene", ""))
        if scene_path != "":
            _trace["events"].append({"type": "load_scene", "frame": _frame, "scene": scene_path})
            get_tree().change_scene_to_file(scene_path)
        _action_index += 1
        return

    if t == "wait_frames":
        if _wait_remaining == 0:
            _wait_remaining = int(action.get("frames", 1))
            _trace["events"].append({"type": "wait_start", "frame": _frame, "frames": _wait_remaining})
        _wait_remaining -= 1
        if _wait_remaining <= 0:
            _trace["events"].append({"type": "wait_end", "frame": _frame})
            _wait_remaining = 0
            _action_index += 1
        return

    if t == "capture":
        var label := str(action.get("label", "capture"))
        _trace["events"].append({"type": "capture", "frame": _frame, "label": label})
        _try_capture_png(label)
        _action_index += 1
        return

    if t == "move":
        if _move_remaining == 0:
            _move_remaining = int(action.get("frames", 1))
            _move_direction = str(action.get("direction", ""))
            _start_move_input(_move_direction)
            _trace["events"].append({"type": "move_start", "frame": _frame, "direction": _move_direction, "frames": _move_remaining})
        _move_remaining -= 1
        if _move_remaining <= 0:
            _stop_move_input()
            _trace["events"].append({"type": "move_end", "frame": _frame})
            _move_remaining = 0
            _move_direction = ""
            _action_index += 1
        return

    if t == "press":
        var input_action := str(action.get("action", ""))
        if input_action != "":
            Input.action_press(input_action)
            # Release next frame to simulate a tap
            await get_tree().process_frame
            Input.action_release(input_action)
            _trace["events"].append({"type": "press", "frame": _frame, "action": input_action})
        _action_index += 1
        return

    if t == "save_game":
        var result: bool = SaveManager.save_game()
        _trace["events"].append({"type": "save_game", "frame": _frame, "success": result})
        _action_index += 1
        return

    if t == "load_game":
        var result: bool = await SaveManager.load_game()
        _trace["events"].append({"type": "load_game", "frame": _frame, "success": result})
        _action_index += 1
        return

    if t == "acquire_tool":
        var tool_id := str(action.get("tool_id", ""))
        if tool_id != "":
            InventoryManager.acquire_tool(tool_id)
            _trace["events"].append({"type": "acquire_tool", "frame": _frame, "tool_id": tool_id})
        _action_index += 1
        return

    if t == "set_story_flag":
        var flag := str(action.get("flag", ""))
        var value = action.get("value", true)
        if flag != "":
            InventoryManager.set_story_flag(flag, value)
            _trace["events"].append({"type": "set_story_flag", "frame": _frame, "flag": flag, "value": value})
        _action_index += 1
        return

    if t == "check_tool":
        var tool_id := str(action.get("tool_id", ""))
        var has_it: bool = InventoryManager.has_tool(tool_id)
        _trace["events"].append({"type": "check_tool", "frame": _frame, "tool_id": tool_id, "has_tool": has_it})
        _action_index += 1
        return

    if t == "check_story_flag":
        var flag := str(action.get("flag", ""))
        var has_it: bool = InventoryManager.has_story_flag(flag)
        _trace["events"].append({"type": "check_story_flag", "frame": _frame, "flag": flag, "has_flag": has_it})
        _action_index += 1
        return

    if t == "set_time_phase":
        var phase: int = int(action.get("phase", 0))
        DayNightManager.set_time_instant(phase)
        _trace["events"].append({"type": "set_time_phase", "frame": _frame, "phase": phase, "phase_name": DayNightManager.get_phase_name()})
        _action_index += 1
        return

    if t == "set_weather":
        var weather: int = int(action.get("weather", 0))
        WeatherManager.set_weather(weather)
        _trace["events"].append({"type": "set_weather", "frame": _frame, "weather": weather, "weather_name": WeatherManager.get_weather_name()})
        _action_index += 1
        return

    if t == "trigger_thunder":
        WeatherManager.trigger_thunder()
        _trace["events"].append({"type": "trigger_thunder", "frame": _frame})
        _action_index += 1
        return

    if t == "equip_item":
        var member_id := str(action.get("member_id", ""))
        var equip_id := str(action.get("equip_id", ""))
        if member_id != "" and equip_id != "":
            var success: bool = PartyManager.equip_item(member_id, equip_id)
            _trace["events"].append({"type": "equip_item", "frame": _frame, "member_id": member_id, "equip_id": equip_id, "success": success})
        _action_index += 1
        return

    if t == "unequip_slot":
        var member_id := str(action.get("member_id", ""))
        var slot := str(action.get("slot", ""))
        if member_id != "" and slot != "":
            var removed: String = PartyManager.unequip_slot(member_id, slot)
            _trace["events"].append({"type": "unequip_slot", "frame": _frame, "member_id": member_id, "slot": slot, "removed": removed})
        _action_index += 1
        return

    if t == "check_equipment":
        var member_id := str(action.get("member_id", ""))
        var equipment: Dictionary = PartyManager.get_equipment(member_id)
        var attack_with_equip: int = PartyManager.get_stat_with_equipment(member_id, "attack")
        var defense_with_equip: int = PartyManager.get_stat_with_equipment(member_id, "defense")
        var speed_with_equip: int = PartyManager.get_stat_with_equipment(member_id, "speed")
        _trace["events"].append({
            "type": "check_equipment",
            "frame": _frame,
            "member_id": member_id,
            "weapon": equipment.get("weapon", ""),
            "armor": equipment.get("armor", ""),
            "accessory": equipment.get("accessory", ""),
            "attack_with_equip": attack_with_equip,
            "defense_with_equip": defense_with_equip,
            "speed_with_equip": speed_with_equip
        })
        _action_index += 1
        return

    if t == "start_quest":
        var quest_id := str(action.get("quest_id", ""))
        if quest_id != "":
            var success: bool = QuestManager.start_quest(quest_id)
            _trace["events"].append({"type": "start_quest", "frame": _frame, "quest_id": quest_id, "success": success})
        _action_index += 1
        return

    if t == "complete_quest":
        var quest_id := str(action.get("quest_id", ""))
        if quest_id != "":
            var success: bool = QuestManager.complete_quest(quest_id)
            _trace["events"].append({"type": "complete_quest", "frame": _frame, "quest_id": quest_id, "success": success})
        _action_index += 1
        return

    if t == "complete_objective":
        var quest_id := str(action.get("quest_id", ""))
        var objective_index: int = int(action.get("objective_index", 0))
        if quest_id != "":
            var success: bool = QuestManager.complete_objective(quest_id, objective_index)
            _trace["events"].append({"type": "complete_objective", "frame": _frame, "quest_id": quest_id, "objective_index": objective_index, "success": success})
        _action_index += 1
        return

    if t == "check_quest":
        var quest_id := str(action.get("quest_id", ""))
        var is_active: bool = QuestManager.is_quest_active(quest_id)
        var is_completed: bool = QuestManager.is_quest_completed(quest_id)
        _trace["events"].append({"type": "check_quest", "frame": _frame, "quest_id": quest_id, "is_active": is_active, "is_completed": is_completed})
        _action_index += 1
        return

    if t == "show_dialogue_choices":
        var prompt := str(action.get("prompt", "Choose an option:"))
        var choices: Array = action.get("choices", [])
        # Convert choice arrays to dictionaries if needed
        var choice_dicts: Array = []
        for c in choices:
            if typeof(c) == TYPE_DICTIONARY:
                choice_dicts.append(c)
            elif typeof(c) == TYPE_ARRAY and c.size() >= 2:
                choice_dicts.append({"text": str(c[0]), "response": str(c[1]), "flag": str(c[2]) if c.size() > 2 else ""})
        DialogueManager.show_dialogue_with_choices(prompt, choice_dicts)
        _trace["events"].append({"type": "show_dialogue_choices", "frame": _frame, "prompt": prompt, "choices_count": choice_dicts.size()})
        _action_index += 1
        return

    if t == "select_dialogue_choice":
        var choice_index: int = int(action.get("choice_index", 0))
        if DialogueManager.is_waiting_for_choice():
            DialogueManager.select_choice(choice_index)
            _trace["events"].append({"type": "select_dialogue_choice", "frame": _frame, "choice_index": choice_index})
        else:
            _trace["events"].append({"type": "select_dialogue_choice", "frame": _frame, "choice_index": choice_index, "error": "not_waiting_for_choice"})
        _action_index += 1
        return

    if t == "hide_dialogue":
        DialogueManager.hide_dialogue()
        _trace["events"].append({"type": "hide_dialogue", "frame": _frame})
        _action_index += 1
        return

    if t == "set_affinity":
        var npc_id := str(action.get("npc_id", ""))
        var value: int = int(action.get("value", 0))
        AffinityManager.set_affinity(npc_id, value)
        _trace["events"].append({"type": "set_affinity", "frame": _frame, "npc_id": npc_id, "value": value})
        _action_index += 1
        return

    if t == "change_affinity":
        var npc_id := str(action.get("npc_id", ""))
        var amount: int = int(action.get("amount", 0))
        var old_value: int = AffinityManager.get_affinity(npc_id)
        AffinityManager.change_affinity(npc_id, amount)
        var new_value: int = AffinityManager.get_affinity(npc_id)
        _trace["events"].append({"type": "change_affinity", "frame": _frame, "npc_id": npc_id, "amount": amount, "old_value": old_value, "new_value": new_value})
        _action_index += 1
        return

    if t == "check_affinity":
        var npc_id := str(action.get("npc_id", ""))
        var affinity: int = AffinityManager.get_affinity(npc_id)
        var level: String = AffinityManager.get_npc_level(npc_id)
        _trace["events"].append({"type": "check_affinity", "frame": _frame, "npc_id": npc_id, "affinity": affinity, "level": level})
        _action_index += 1
        return

    if t == "pause_game":
        PauseManager.pause_game()
        _trace["events"].append({"type": "pause_game", "frame": _frame, "is_paused": PauseManager.is_paused()})
        _action_index += 1
        return

    if t == "unpause_game":
        PauseManager.unpause_game()
        _trace["events"].append({"type": "unpause_game", "frame": _frame, "is_paused": PauseManager.is_paused()})
        _action_index += 1
        return

    if t == "toggle_pause":
        PauseManager.toggle_pause()
        _trace["events"].append({"type": "toggle_pause", "frame": _frame, "is_paused": PauseManager.is_paused()})
        _action_index += 1
        return

    if t == "check_pause":
        _trace["events"].append({"type": "check_pause", "frame": _frame, "is_paused": PauseManager.is_paused()})
        _action_index += 1
        return

    # Unknown action types are currently no-ops.
    _trace["events"].append({"type": "noop", "frame": _frame, "action": t})
    _action_index += 1

func _try_capture_png(label: String) -> void:
    if capture_dir == "":
        return

    var file_path := "%s/%04d_%s.png" % [capture_dir, _frame, label]

    # In headless runs, this may produce empty images; we still attempt and never crash.
    var tex := get_viewport().get_texture()
    if tex == null:
        return
    var img := tex.get_image()
    if img == null:
        return
    img.save_png(file_path)

func _write_trace() -> void:
    if capture_dir == "":
        return

    var file_path := "%s/trace.json" % capture_dir
    var f := FileAccess.open(file_path, FileAccess.WRITE)
    f.store_string(JSON.stringify(_trace, "  "))
    f.close()

func _start_move_input(direction: String) -> void:
    # Simulate directional input by sending input actions
    match direction:
        "left":
            Input.action_press("ui_left")
        "right":
            Input.action_press("ui_right")
        "up":
            Input.action_press("ui_up")
        "down":
            Input.action_press("ui_down")

func _stop_move_input() -> void:
    # Release all directional inputs
    Input.action_release("ui_left")
    Input.action_release("ui_right")
    Input.action_release("ui_up")
    Input.action_release("ui_down")
