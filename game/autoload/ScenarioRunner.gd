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
        var slot: int = int(action.get("slot", 0))
        var result: bool = SaveManager.save_game(slot)
        _trace["events"].append({"type": "save_game", "frame": _frame, "slot": slot, "success": result})
        print("[Scenario] save_game slot=%d success=%s" % [slot, result])
        _action_index += 1
        return

    if t == "load_game":
        var slot: int = int(action.get("slot", 0))
        var result: bool = await SaveManager.load_game(slot)
        _trace["events"].append({"type": "load_game", "frame": _frame, "slot": slot, "success": result})
        print("[Scenario] load_game slot=%d success=%s" % [slot, result])
        _action_index += 1
        return

    if t == "delete_save":
        var slot: int = int(action.get("slot", 0))
        var result: bool = SaveManager.delete_save(slot)
        _trace["events"].append({"type": "delete_save", "frame": _frame, "slot": slot, "success": result})
        print("[Scenario] delete_save slot=%d success=%s" % [slot, result])
        _action_index += 1
        return

    if t == "check_save_slots":
        var previews: Array = []
        for i in range(SaveManager.MAX_SLOTS):
            previews.append(SaveManager.get_slot_preview(i))
        _trace["events"].append({"type": "check_save_slots", "frame": _frame, "slots": previews})
        for preview: Dictionary in previews:
            var slot_idx: int = int(preview.get("slot", -1))
            var empty: bool = preview.get("empty", true)
            var area: String = preview.get("area_name", "")
            print("[Scenario] Slot %d: empty=%s area=%s" % [slot_idx, empty, area])
        _action_index += 1
        return

    if t == "has_save":
        var slot: int = int(action.get("slot", 0))
        var has_it: bool = SaveManager.has_save(slot)
        _trace["events"].append({"type": "has_save", "frame": _frame, "slot": slot, "has_save": has_it})
        print("[Scenario] has_save slot=%d: %s" % [slot, has_it])
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

    if t == "add_inventory_item":
        var item_id := str(action.get("item_id", ""))
        var count: int = int(action.get("count", 1))
        if item_id != "":
            InventoryManager.add_item(item_id, count)
            _trace["events"].append({"type": "add_inventory_item", "frame": _frame, "item_id": item_id, "count": count})
        _action_index += 1
        return

    if t == "remove_inventory_item":
        var item_id := str(action.get("item_id", ""))
        var count: int = int(action.get("count", 1))
        if item_id != "":
            var success: bool = InventoryManager.remove_item(item_id, count)
            _trace["events"].append({"type": "remove_inventory_item", "frame": _frame, "item_id": item_id, "count": count, "success": success})
        _action_index += 1
        return

    if t == "check_inventory":
        var item_id := str(action.get("item_id", ""))
        var count: int = InventoryManager.get_item_count(item_id)
        _trace["events"].append({"type": "check_inventory", "frame": _frame, "item_id": item_id, "count": count})
        _action_index += 1
        return

    if t == "open_inventory":
        var inventory_scene := preload("res://game/scenes/ui/InventoryUI.tscn")
        var inventory_ui := inventory_scene.instantiate()
        get_tree().root.add_child(inventory_ui)
        inventory_ui.open_inventory()
        _trace["events"].append({"type": "open_inventory", "frame": _frame})
        _action_index += 1
        return

    if t == "close_inventory":
        var inventory_nodes := get_tree().get_nodes_in_group("inventory_ui")
        for node in inventory_nodes:
            node.close_inventory()
            node.queue_free()
        _trace["events"].append({"type": "close_inventory", "frame": _frame})
        _action_index += 1
        return

    if t == "open_party_status":
        var party_scene := preload("res://game/scenes/ui/PartyStatusUI.tscn")
        var party_ui := party_scene.instantiate()
        get_tree().root.add_child(party_ui)
        party_ui.open_party_status()
        _trace["events"].append({"type": "open_party_status", "frame": _frame})
        _action_index += 1
        return

    if t == "close_party_status":
        var party_nodes := get_tree().get_nodes_in_group("party_status_ui")
        for node in party_nodes:
            node.close_party_status()
            node.queue_free()
        _trace["events"].append({"type": "close_party_status", "frame": _frame})
        _action_index += 1
        return

    if t == "check_party_member":
        var member_id := str(action.get("member_id", ""))
        var state: Dictionary = PartyManager.get_member_state(member_id)
        _trace["events"].append({"type": "check_party_member", "frame": _frame, "member_id": member_id, "state": state})
        _action_index += 1
        return

    if t == "set_active_pet":
        var pet_id := str(action.get("pet_id", "maddie"))
        var success: bool = PartyManager.set_active_pet(pet_id)
        _trace["events"].append({"type": "set_active_pet", "frame": _frame, "pet_id": pet_id, "success": success})
        _action_index += 1
        return

    if t == "check_active_pet":
        var active_pet: String = PartyManager.get_active_pet()
        var pet_data: Dictionary = PartyManager.get_active_pet_data()
        _trace["events"].append({"type": "check_active_pet", "frame": _frame, "active_pet": active_pet, "pet_data": pet_data})
        _action_index += 1
        return

    if t == "check_pet_options":
        var pet_options: Array = PartyManager.get_pet_options()
        var pet_ids: Array = []
        for pet in pet_options:
            pet_ids.append(pet.get("id", ""))
        _trace["events"].append({"type": "check_pet_options", "frame": _frame, "pet_count": pet_options.size(), "pet_ids": pet_ids})
        _action_index += 1
        return

    if t == "open_quest_log":
        var quest_log_scene := preload("res://game/scenes/ui/QuestLogUI.tscn")
        var quest_log_ui := quest_log_scene.instantiate()
        get_tree().root.add_child(quest_log_ui)
        quest_log_ui.open_quest_log()
        _trace["events"].append({"type": "open_quest_log", "frame": _frame})
        _action_index += 1
        return

    if t == "close_quest_log":
        var quest_log_nodes := get_tree().get_nodes_in_group("quest_log_ui")
        for node in quest_log_nodes:
            node.close_quest_log()
            node.queue_free()
        _trace["events"].append({"type": "close_quest_log", "frame": _frame})
        _action_index += 1
        return

    if t == "start_quest":
        var quest_id := str(action.get("quest_id", ""))
        if quest_id != "":
            QuestManager.start_quest(quest_id)
            _trace["events"].append({"type": "start_quest", "frame": _frame, "quest_id": quest_id})
        _action_index += 1
        return

    if t == "complete_quest":
        var quest_id := str(action.get("quest_id", ""))
        if quest_id != "":
            QuestManager.complete_quest(quest_id)
            _trace["events"].append({"type": "complete_quest", "frame": _frame, "quest_id": quest_id})
        _action_index += 1
        return

    if t == "open_map":
        var map_scene := preload("res://game/scenes/ui/MapScreenUI.tscn")
        var map_ui := map_scene.instantiate()
        get_tree().root.add_child(map_ui)
        map_ui.open_map()
        _trace["events"].append({"type": "open_map", "frame": _frame})
        _action_index += 1
        return

    if t == "close_map":
        var map_nodes := get_tree().get_nodes_in_group("map_screen_ui")
        for node in map_nodes:
            node.close_map()
            node.queue_free()
        _trace["events"].append({"type": "close_map", "frame": _frame})
        _action_index += 1
        return

    if t == "open_settings":
        var settings_scene := preload("res://game/scenes/ui/SettingsUI.tscn")
        var settings_ui := settings_scene.instantiate()
        get_tree().root.add_child(settings_ui)
        settings_ui.open_settings()
        _trace["events"].append({"type": "open_settings", "frame": _frame})
        _action_index += 1
        return

    if t == "close_settings":
        var settings_nodes := get_tree().get_nodes_in_group("settings_ui")
        for node in settings_nodes:
            node.close_settings()
            node.queue_free()
        _trace["events"].append({"type": "close_settings", "frame": _frame})
        _action_index += 1
        return

    if t == "set_music_volume":
        var value := float(action.get("value", 1.0))
        SettingsManager.set_music_volume(value)
        _trace["events"].append({"type": "set_music_volume", "frame": _frame, "value": value})
        _action_index += 1
        return

    if t == "set_sfx_volume":
        var value := float(action.get("value", 1.0))
        SettingsManager.set_sfx_volume(value)
        _trace["events"].append({"type": "set_sfx_volume", "frame": _frame, "value": value})
        _action_index += 1
        return

    if t == "play_music":
        var track_id := str(action.get("track_id", ""))
        if track_id != "":
            MusicManager.play_music(track_id)
        _trace["events"].append({"type": "play_music", "frame": _frame, "track_id": track_id})
        _action_index += 1
        return

    if t == "play_area_music":
        var area_name := str(action.get("area", ""))
        if area_name != "":
            MusicManager.play_area_music(area_name)
        _trace["events"].append({"type": "play_area_music", "frame": _frame, "area": area_name})
        _action_index += 1
        return

    if t == "play_battle_music":
        MusicManager.play_battle_music()
        _trace["events"].append({"type": "play_battle_music", "frame": _frame})
        _action_index += 1
        return

    if t == "stop_music":
        MusicManager.stop_music()
        _trace["events"].append({"type": "stop_music", "frame": _frame})
        _action_index += 1
        return

    if t == "check_music":
        var current: String = MusicManager.get_current_track()
        _trace["events"].append({"type": "check_music", "frame": _frame, "current_track": current})
        print("[Scenario] Current music: ", current)
        _action_index += 1
        return

    # SFX actions
    if t == "play_sfx":
        var sfx_id: String = str(action.get("sfx_id", ""))
        if sfx_id != "":
            SFXManager.play(sfx_id)
            _trace["events"].append({"type": "play_sfx", "frame": _frame, "sfx_id": sfx_id})
        _action_index += 1
        return

    if t == "check_sfx":
        var last_sfx: String = SFXManager.get_last_sfx()
        _trace["events"].append({"type": "check_sfx", "frame": _frame, "last_sfx": last_sfx})
        print("[Scenario] Last SFX: ", last_sfx)
        _action_index += 1
        return

    if t == "stop_sfx":
        SFXManager.stop_all()
        _trace["events"].append({"type": "stop_sfx", "frame": _frame})
        _action_index += 1
        return

    # Notification actions
    if t == "show_notification":
        var title: String = str(action.get("title", ""))
        var message: String = str(action.get("message", ""))
        NotificationManager.show_notification(title, message)
        _trace["events"].append({"type": "show_notification", "frame": _frame, "title": title, "message": message})
        _action_index += 1
        return

    if t == "show_quest_notification":
        var quest_name: String = str(action.get("quest_name", ""))
        NotificationManager.show_quest_received(quest_name)
        _trace["events"].append({"type": "show_quest_notification", "frame": _frame, "quest_name": quest_name})
        _action_index += 1
        return

    if t == "show_item_notification":
        var item_name: String = str(action.get("item_name", ""))
        var count: int = action.get("count", 1)
        NotificationManager.show_item_obtained(item_name, count)
        _trace["events"].append({"type": "show_item_notification", "frame": _frame, "item_name": item_name, "count": count})
        _action_index += 1
        return

    if t == "show_level_up_notification":
        var character_name: String = str(action.get("character_name", "Hero"))
        var new_level: int = action.get("new_level", 1)
        NotificationManager.show_level_up(character_name, new_level)
        _trace["events"].append({"type": "show_level_up_notification", "frame": _frame, "character_name": character_name, "new_level": new_level})
        _action_index += 1
        return

    if t == "check_notification":
        var current := NotificationManager.get_current_notification()
        var is_showing := NotificationManager.is_showing()
        var queue_size := NotificationManager.get_queue_size()
        _trace["events"].append({"type": "check_notification", "frame": _frame, "is_showing": is_showing, "current": current, "queue_size": queue_size})
        print("[Scenario] Notification showing: %s, queue: %d" % [is_showing, queue_size])
        _action_index += 1
        return

    if t == "clear_notifications":
        NotificationManager.clear_all()
        _trace["events"].append({"type": "clear_notifications", "frame": _frame})
        _action_index += 1
        return

    # Text size / accessibility actions
    if t == "set_text_size":
        var size: int = action.get("size", 1)
        SettingsManager.set_text_size(size)
        _trace["events"].append({"type": "set_text_size", "frame": _frame, "size": size})
        _action_index += 1
        return

    if t == "check_text_size":
        var current_size: int = SettingsManager.text_size
        var scale: float = SettingsManager.get_text_size_scale()
        var name: String = SettingsManager.get_text_size_name()
        _trace["events"].append({"type": "check_text_size", "frame": _frame, "size": current_size, "scale": scale, "name": name})
        print("[Scenario] Text size: %d (%s, scale=%.1f)" % [current_size, name, scale])
        _action_index += 1
        return

    # Localization actions
    if t == "set_locale":
        var locale: String = action.get("locale", "en")
        LocalizationManager.set_locale(locale)
        SettingsManager.set_locale(locale)
        _trace["events"].append({"type": "set_locale", "frame": _frame, "locale": locale})
        print("[Scenario] Locale set to: %s" % locale)
        _action_index += 1
        return

    if t == "check_locale":
        var current_locale: String = LocalizationManager.get_locale()
        var locale_name: String = LocalizationManager.get_current_locale_name()
        _trace["events"].append({"type": "check_locale", "frame": _frame, "locale": current_locale, "name": locale_name})
        print("[Scenario] Locale: %s (%s)" % [current_locale, locale_name])
        _action_index += 1
        return

    if t == "check_translation":
        var key: String = action.get("key", "")
        var translated: String = tr(key)
        _trace["events"].append({"type": "check_translation", "frame": _frame, "key": key, "translated": translated})
        print("[Scenario] Translation '%s' -> '%s'" % [key, translated])
        _action_index += 1
        return

    # Tutorial hints actions
    if t == "show_hint":
        var hint_id: String = str(action.get("hint_id", ""))
        TutorialHintsManager.show_hint(hint_id)
        _trace["events"].append({"type": "show_hint", "frame": _frame, "hint_id": hint_id})
        _action_index += 1
        return

    if t == "dismiss_hint":
        TutorialHintsManager.dismiss_current_hint()
        _trace["events"].append({"type": "dismiss_hint", "frame": _frame})
        _action_index += 1
        return

    if t == "check_hint":
        var hint_id: String = str(action.get("hint_id", ""))
        var current_hint: String = TutorialHintsManager.get_current_hint()
        var has_seen: bool = TutorialHintsManager.has_seen_hint(hint_id)
        var dismissed_hints: Array = TutorialHintsManager.get_dismissed_hints()
        _trace["events"].append({"type": "check_hint", "frame": _frame, "hint_id": hint_id, "current_hint": current_hint, "has_seen": has_seen, "dismissed_count": dismissed_hints.size()})
        print("[Scenario] Hint check: %s, current=%s, seen=%s, dismissed=%d" % [hint_id, current_hint, has_seen, dismissed_hints.size()])
        _action_index += 1
        return

    if t == "reset_hint":
        var hint_id: String = str(action.get("hint_id", ""))
        TutorialHintsManager.reset_hint(hint_id)
        _trace["events"].append({"type": "reset_hint", "frame": _frame, "hint_id": hint_id})
        _action_index += 1
        return

    if t == "reset_all_hints":
        TutorialHintsManager.reset_all_hints()
        _trace["events"].append({"type": "reset_all_hints", "frame": _frame})
        _action_index += 1
        return

    if t == "set_hints_enabled":
        var enabled: bool = action.get("enabled", true)
        TutorialHintsManager.set_hints_enabled(enabled)
        _trace["events"].append({"type": "set_hints_enabled", "frame": _frame, "enabled": enabled})
        _action_index += 1
        return

    # Performance testing actions
    if t == "check_fps":
        var fps := Engine.get_frames_per_second()
        _trace["events"].append({"type": "check_fps", "frame": _frame, "fps": fps})
        print("[Scenario] FPS: %d" % fps)
        _action_index += 1
        return

    if t == "spawn_stress_entities":
        var count: int = int(action.get("count", 10))
        var spawned := 0
        for i in range(count):
            var sprite := Sprite2D.new()
            sprite.position = Vector2(randf_range(0, 512), randf_range(0, 288))
            sprite.modulate = Color(randf(), randf(), randf(), 1.0)
            get_tree().current_scene.add_child(sprite)
            spawned += 1
        _trace["events"].append({"type": "spawn_stress_entities", "frame": _frame, "count": spawned})
        print("[Scenario] Spawned %d stress entities" % spawned)
        _action_index += 1
        return

    if t == "stress_loop":
        var iterations: int = int(action.get("iterations", 1000))
        var result := 0.0
        for i in range(iterations):
            result += sin(float(i)) * cos(float(i))
        _trace["events"].append({"type": "stress_loop", "frame": _frame, "iterations": iterations, "result": result})
        print("[Scenario] Stress loop: %d iterations" % iterations)
        _action_index += 1
        return

    # Cutscene actions
    if t == "play_cutscene":
        var cutscene_id: String = str(action.get("cutscene_id", ""))
        var can_skip: bool = action.get("can_skip", true)
        if cutscene_id != "":
            var success: bool = CutsceneManager.play_cutscene(cutscene_id, can_skip)
            _trace["events"].append({"type": "play_cutscene", "frame": _frame, "cutscene_id": cutscene_id, "can_skip": can_skip, "success": success})
            print("[Scenario] play_cutscene: %s, success=%s" % [cutscene_id, success])
        _action_index += 1
        return

    if t == "skip_cutscene":
        CutsceneManager.skip_cutscene()
        _trace["events"].append({"type": "skip_cutscene", "frame": _frame})
        print("[Scenario] skip_cutscene")
        _action_index += 1
        return

    if t == "check_cutscene":
        var is_playing: bool = CutsceneManager.is_playing()
        var current_id: String = CutsceneManager.get_current_cutscene_id()
        var can_skip: bool = CutsceneManager.can_skip_current()
        _trace["events"].append({"type": "check_cutscene", "frame": _frame, "is_playing": is_playing, "current_id": current_id, "can_skip": can_skip})
        print("[Scenario] check_cutscene: playing=%s, id=%s, can_skip=%s" % [is_playing, current_id, can_skip])
        _action_index += 1
        return

    if t == "wait_cutscene_end":
        if CutsceneManager.is_playing():
            # Stay on this action until cutscene ends
            return
        _trace["events"].append({"type": "wait_cutscene_end", "frame": _frame})
        _action_index += 1
        return

    # Photo mode actions
    if t == "enter_photo_mode":
        PhotoModeManager.enter_photo_mode()
        _trace["events"].append({"type": "enter_photo_mode", "frame": _frame})
        print("[Scenario] enter_photo_mode")
        _action_index += 1
        return

    if t == "exit_photo_mode":
        PhotoModeManager.exit_photo_mode()
        _trace["events"].append({"type": "exit_photo_mode", "frame": _frame})
        print("[Scenario] exit_photo_mode")
        _action_index += 1
        return

    if t == "hide_photo_ui":
        PhotoModeManager.hide_ui()
        _trace["events"].append({"type": "hide_photo_ui", "frame": _frame})
        print("[Scenario] hide_photo_ui")
        _action_index += 1
        return

    if t == "show_photo_ui":
        PhotoModeManager.show_ui()
        _trace["events"].append({"type": "show_photo_ui", "frame": _frame})
        print("[Scenario] show_photo_ui")
        _action_index += 1
        return

    if t == "take_photo":
        # Note: take_photo is async but we just trigger it and move on
        PhotoModeManager.take_photo()
        _trace["events"].append({"type": "take_photo", "frame": _frame})
        print("[Scenario] take_photo")
        _action_index += 1
        return

    if t == "check_photo_mode":
        var is_active: bool = PhotoModeManager.is_active()
        var ui_hidden: bool = PhotoModeManager.is_ui_hidden()
        var photo_count: int = PhotoModeManager.get_photo_count()
        _trace["events"].append({"type": "check_photo_mode", "frame": _frame, "is_active": is_active, "ui_hidden": ui_hidden, "photo_count": photo_count})
        print("[Scenario] check_photo_mode: active=%s, ui_hidden=%s, photos=%d" % [is_active, ui_hidden, photo_count])
        _action_index += 1
        return

    # Achievement actions
    if t == "unlock_achievement":
        var achievement_id: String = str(action.get("achievement_id", ""))
        if achievement_id != "":
            var success: bool = AchievementManager.unlock_achievement(achievement_id)
            _trace["events"].append({"type": "unlock_achievement", "frame": _frame, "achievement_id": achievement_id, "success": success})
            print("[Scenario] unlock_achievement: %s, success=%s" % [achievement_id, success])
        _action_index += 1
        return

    if t == "record_progress":
        var trigger_type: String = str(action.get("trigger", ""))
        var amount: int = int(action.get("amount", 1))
        if trigger_type != "":
            AchievementManager.record_progress(trigger_type, amount)
            var current: int = AchievementManager.get_progress(trigger_type)
            _trace["events"].append({"type": "record_progress", "frame": _frame, "trigger": trigger_type, "amount": amount, "current": current})
            print("[Scenario] record_progress: %s +%d (now %d)" % [trigger_type, amount, current])
        _action_index += 1
        return

    if t == "check_achievement":
        var achievement_id: String = str(action.get("achievement_id", ""))
        var is_unlocked: bool = false
        if achievement_id != "":
            is_unlocked = AchievementManager.is_unlocked(achievement_id)
        var total_points: int = AchievementManager.get_total_points()
        var unlocked_count: int = AchievementManager.get_unlocked_achievement_ids().size()
        _trace["events"].append({"type": "check_achievement", "frame": _frame, "achievement_id": achievement_id, "is_unlocked": is_unlocked, "total_points": total_points, "unlocked_count": unlocked_count})
        print("[Scenario] check_achievement: id=%s unlocked=%s, total_points=%d, unlocked_count=%d" % [achievement_id, is_unlocked, total_points, unlocked_count])
        _action_index += 1
        return

    if t == "reset_achievements":
        AchievementManager.reset_all()
        _trace["events"].append({"type": "reset_achievements", "frame": _frame})
        print("[Scenario] reset_achievements")
        _action_index += 1
        return

    # Analytics actions
    if t == "track_event":
        var event_name: String = str(action.get("event", ""))
        var properties: Dictionary = action.get("properties", {})
        if event_name != "":
            AnalyticsManager.track_event(event_name, properties)
            _trace["events"].append({"type": "track_event", "frame": _frame, "event": event_name, "properties": properties})
            print("[Scenario] track_event: %s %s" % [event_name, properties])
        _action_index += 1
        return

    if t == "check_analytics":
        var event_count: int = AnalyticsManager.get_event_count()
        var session_id: String = AnalyticsManager.session_id
        var session_duration: float = AnalyticsManager.get_session_duration()
        var session_active: bool = AnalyticsManager.is_session_active()
        _trace["events"].append({"type": "check_analytics", "frame": _frame, "event_count": event_count, "session_id": session_id, "session_duration": session_duration, "session_active": session_active})
        print("[Scenario] Analytics: session=%s, events=%d, duration=%.1fs, active=%s" % [session_id, event_count, session_duration, session_active])
        _action_index += 1
        return

    if t == "clear_analytics":
        AnalyticsManager.clear_event_buffer()
        _trace["events"].append({"type": "clear_analytics", "frame": _frame})
        print("[Scenario] clear_analytics")
        _action_index += 1
        return

    # Crash report actions
    if t == "log_error":
        var message: String = str(action.get("message", "Test error"))
        var error_type: String = str(action.get("error_type", "ERROR"))
        CrashReportManager.log_error(message, error_type)
        _trace["events"].append({"type": "log_error", "frame": _frame, "message": message, "error_type": error_type})
        print("[Scenario] log_error: %s (%s)" % [message, error_type])
        _action_index += 1
        return

    if t == "check_crash_reports":
        var error_count: int = CrashReportManager.get_error_count()
        var errors: Array[Dictionary] = CrashReportManager.get_error_buffer()
        _trace["events"].append({"type": "check_crash_reports", "frame": _frame, "error_count": error_count})
        print("[Scenario] Crash reports: %d errors logged" % error_count)
        _action_index += 1
        return

    if t == "clear_crash_reports":
        CrashReportManager.clear_error_buffer()
        _trace["events"].append({"type": "clear_crash_reports", "frame": _frame})
        print("[Scenario] clear_crash_reports")
        _action_index += 1
        return

    # Hot reload actions
    if t == "enable_hot_reload":
        var enabled: bool = action.get("enabled", true)
        GameData.enable_hot_reload(enabled)
        _trace["events"].append({"type": "enable_hot_reload", "frame": _frame, "enabled": enabled})
        print("[Scenario] enable_hot_reload: %s" % enabled)
        _action_index += 1
        return

    if t == "reload_data":
        GameData.reload_all()
        _trace["events"].append({"type": "reload_data", "frame": _frame})
        print("[Scenario] reload_data")
        _action_index += 1
        return

    if t == "check_hot_reload":
        var enabled: bool = GameData.hot_reload_enabled
        _trace["events"].append({"type": "check_hot_reload", "frame": _frame, "enabled": enabled})
        print("[Scenario] check_hot_reload: enabled=%s" % enabled)
        _action_index += 1
        return

    # Debug console actions
    if t == "toggle_debug_console":
        DebugConsole.toggle_console()
        _trace["events"].append({"type": "toggle_debug_console", "frame": _frame})
        print("[Scenario] toggle_debug_console")
        _action_index += 1
        return

    if t == "show_debug_console":
        DebugConsole.show_console()
        _trace["events"].append({"type": "show_debug_console", "frame": _frame})
        print("[Scenario] show_debug_console")
        _action_index += 1
        return

    if t == "hide_debug_console":
        DebugConsole.hide_console()
        _trace["events"].append({"type": "hide_debug_console", "frame": _frame})
        print("[Scenario] hide_debug_console")
        _action_index += 1
        return

    if t == "debug_command":
        var command: String = action.get("command", "")
        var result: String = DebugConsole.execute_command(command)
        _trace["events"].append({"type": "debug_command", "frame": _frame, "command": command, "result": result})
        print("[Scenario] debug_command: %s -> %s" % [command, result])
        _action_index += 1
        return

    if t == "check_debug_console":
        var visible: bool = DebugConsole.is_visible()
        _trace["events"].append({"type": "check_debug_console", "frame": _frame, "visible": visible})
        print("[Scenario] check_debug_console: visible=%s" % visible)
        _action_index += 1
        return

    # Collection log actions
    if t == "record_collection":
        var category_id: String = str(action.get("category", ""))
        var item_id: String = str(action.get("item_id", ""))
        var count: int = int(action.get("count", 1))
        if category_id != "" and item_id != "":
            CollectionLogManager.record_collection(category_id, item_id, count)
            _trace["events"].append({"type": "record_collection", "frame": _frame, "category": category_id, "item_id": item_id, "count": count})
            print("[Scenario] record_collection: %s/%s x%d" % [category_id, item_id, count])
        _action_index += 1
        return

    if t == "check_collection":
        var category_id: String = str(action.get("category", ""))
        var collected_count: int = CollectionLogManager.get_collected_count(category_id)
        var total_count: int = CollectionLogManager.get_total_count(category_id)
        var completion: float = CollectionLogManager.get_completion_percent(category_id)
        _trace["events"].append({"type": "check_collection", "frame": _frame, "category": category_id, "collected": collected_count, "total": total_count, "percent": completion})
        print("[Scenario] check_collection: %s = %d/%d (%.1f%%)" % [category_id, collected_count, total_count, completion])
        _action_index += 1
        return

    if t == "check_overall_collection":
        var overall_percent: float = CollectionLogManager.get_overall_completion_percent()
        var categories: Array = CollectionLogManager.get_categories()
        _trace["events"].append({"type": "check_overall_collection", "frame": _frame, "percent": overall_percent, "category_count": categories.size()})
        print("[Scenario] check_overall_collection: %.1f%% across %d categories" % [overall_percent, categories.size()])
        _action_index += 1
        return

    if t == "claim_milestone":
        var category_id: String = str(action.get("category", ""))
        var percent: int = int(action.get("percent", 0))
        var reward: Dictionary = CollectionLogManager.claim_milestone(category_id, percent)
        var success: bool = reward.size() > 0
        _trace["events"].append({"type": "claim_milestone", "frame": _frame, "category": category_id, "percent": percent, "success": success})
        print("[Scenario] claim_milestone: %s %d%% success=%s" % [category_id, percent, success])
        _action_index += 1
        return

    if t == "reset_collection":
        CollectionLogManager.reset_progress()
        _trace["events"].append({"type": "reset_collection", "frame": _frame})
        print("[Scenario] reset_collection")
        _action_index += 1
        return

    # Seasonal event actions
    if t == "set_event_date":
        var month: int = int(action.get("month", 1))
        var day: int = int(action.get("day", 1))
        SeasonalEventManager.set_override_date(month, day)
        _trace["events"].append({"type": "set_event_date", "frame": _frame, "month": month, "day": day})
        print("[Scenario] set_event_date: %d/%d" % [month, day])
        _action_index += 1
        return

    if t == "clear_event_date":
        SeasonalEventManager.clear_override_date()
        _trace["events"].append({"type": "clear_event_date", "frame": _frame})
        print("[Scenario] clear_event_date")
        _action_index += 1
        return

    if t == "check_active_events":
        var active: Array = SeasonalEventManager.get_active_events()
        _trace["events"].append({"type": "check_active_events", "frame": _frame, "active_events": active})
        print("[Scenario] check_active_events: %s" % str(active))
        _action_index += 1
        return

    if t == "check_event_active":
        var event_id: String = str(action.get("event_id", ""))
        var is_active: bool = SeasonalEventManager.is_event_active(event_id)
        _trace["events"].append({"type": "check_event_active", "frame": _frame, "event_id": event_id, "is_active": is_active})
        print("[Scenario] check_event_active: %s = %s" % [event_id, is_active])
        _action_index += 1
        return

    # Daily challenge actions
    if t == "set_challenge_day":
        var day: int = int(action.get("day", 1))
        DailyChallengeManager.set_override_day(day)
        _trace["events"].append({"type": "set_challenge_day", "frame": _frame, "day": day})
        print("[Scenario] set_challenge_day: %d" % day)
        _action_index += 1
        return

    if t == "clear_challenge_day":
        DailyChallengeManager.clear_override_day()
        _trace["events"].append({"type": "clear_challenge_day", "frame": _frame})
        print("[Scenario] clear_challenge_day")
        _action_index += 1
        return

    if t == "check_active_challenges":
        var challenges: Array = DailyChallengeManager.get_active_challenges()
        var ids: Array = []
        for c in challenges:
            ids.append(c.get("id", ""))
        _trace["events"].append({"type": "check_active_challenges", "frame": _frame, "count": challenges.size(), "ids": ids})
        print("[Scenario] check_active_challenges: %d challenges - %s" % [challenges.size(), str(ids)])
        _action_index += 1
        return

    if t == "record_challenge_progress":
        var challenge_type: String = str(action.get("challenge_type", ""))
        var amount: int = int(action.get("amount", 1))
        DailyChallengeManager.record_progress(challenge_type, amount)
        _trace["events"].append({"type": "record_challenge_progress", "frame": _frame, "challenge_type": challenge_type, "amount": amount})
        print("[Scenario] record_challenge_progress: %s +%d" % [challenge_type, amount])
        _action_index += 1
        return

    if t == "check_challenge_completed":
        var challenge_id: String = str(action.get("challenge_id", ""))
        var is_completed: bool = DailyChallengeManager.is_challenge_completed(challenge_id)
        var progress: int = DailyChallengeManager.get_challenge_progress(challenge_id)
        _trace["events"].append({"type": "check_challenge_completed", "frame": _frame, "challenge_id": challenge_id, "is_completed": is_completed, "progress": progress})
        print("[Scenario] check_challenge_completed: %s = %s (progress: %d)" % [challenge_id, is_completed, progress])
        _action_index += 1
        return

    if t == "force_refresh_challenges":
        DailyChallengeManager.force_refresh()
        _trace["events"].append({"type": "force_refresh_challenges", "frame": _frame})
        print("[Scenario] force_refresh_challenges")
        _action_index += 1
        return

    # Trading actions
    if t == "start_trade":
        var success: bool = TradingManager.start_trade()
        _trace["events"].append({"type": "start_trade", "frame": _frame, "success": success})
        print("[Scenario] start_trade: success=%s" % success)
        _action_index += 1
        return

    if t == "add_to_trade":
        var item_id: String = str(action.get("item_id", ""))
        var count: int = int(action.get("count", 1))
        var success: bool = TradingManager.add_to_offer(item_id, count)
        _trace["events"].append({"type": "add_to_trade", "frame": _frame, "item_id": item_id, "count": count, "success": success})
        print("[Scenario] add_to_trade: %s x%d success=%s" % [item_id, count, success])
        _action_index += 1
        return

    if t == "set_their_offer":
        var items: Array = action.get("items", [])
        TradingManager.set_their_offer(items)
        _trace["events"].append({"type": "set_their_offer", "frame": _frame, "item_count": items.size()})
        print("[Scenario] set_their_offer: %d items" % items.size())
        _action_index += 1
        return

    if t == "confirm_trade":
        var success: bool = TradingManager.confirm_trade()
        _trace["events"].append({"type": "confirm_trade", "frame": _frame, "success": success})
        print("[Scenario] confirm_trade: success=%s" % success)
        _action_index += 1
        return

    if t == "simulate_their_confirm":
        TradingManager.simulate_their_confirm()
        _trace["events"].append({"type": "simulate_their_confirm", "frame": _frame})
        print("[Scenario] simulate_their_confirm")
        _action_index += 1
        return

    if t == "cancel_trade":
        TradingManager.cancel_trade()
        _trace["events"].append({"type": "cancel_trade", "frame": _frame})
        print("[Scenario] cancel_trade")
        _action_index += 1
        return

    if t == "check_trade_state":
        var state: int = TradingManager.get_trade_state()
        var my_offer: Array = TradingManager.get_my_offer()
        var their_offer: Array = TradingManager.get_their_offer()
        _trace["events"].append({"type": "check_trade_state", "frame": _frame, "state": state, "my_offer_count": my_offer.size(), "their_offer_count": their_offer.size()})
        print("[Scenario] check_trade_state: state=%d my_offer=%d their_offer=%d" % [state, my_offer.size(), their_offer.size()])
        _action_index += 1
        return

    # === Sticker actions ===
    if t == "unlock_sticker":
        var sticker_id: String = action.get("sticker_id", "")
        var result: bool = StickerManager.unlock_sticker(sticker_id)
        _trace["events"].append({"type": "unlock_sticker", "frame": _frame, "sticker_id": sticker_id, "success": result})
        print("[Scenario] unlock_sticker: %s -> %s" % [sticker_id, str(result)])
        _action_index += 1
        return

    if t == "check_sticker_unlocked":
        var sticker_id: String = action.get("sticker_id", "")
        var unlocked: bool = StickerManager.is_sticker_unlocked(sticker_id)
        _trace["events"].append({"type": "check_sticker_unlocked", "frame": _frame, "sticker_id": sticker_id, "unlocked": unlocked})
        print("[Scenario] check_sticker_unlocked: %s -> %s" % [sticker_id, str(unlocked)])
        _action_index += 1
        return

    if t == "check_stickers":
        var unlocked_count: int = StickerManager.get_unlocked_count()
        var total_count: int = StickerManager.get_total_count()
        _trace["events"].append({"type": "check_stickers", "frame": _frame, "unlocked": unlocked_count, "total": total_count})
        print("[Scenario] check_stickers: %d/%d unlocked" % [unlocked_count, total_count])
        _action_index += 1
        return

    if t == "reset_stickers":
        StickerManager.reset_unlocks()
        _trace["events"].append({"type": "reset_stickers", "frame": _frame})
        print("[Scenario] reset_stickers")
        _action_index += 1
        return

    if t == "check_sticker_conditions":
        StickerManager.check_unlock_conditions()
        var unlocked_count: int = StickerManager.get_unlocked_count()
        _trace["events"].append({"type": "check_sticker_conditions", "frame": _frame, "unlocked_after": unlocked_count})
        print("[Scenario] check_sticker_conditions: %d unlocked after check" % unlocked_count)
        _action_index += 1
        return

    # === Home Customization actions ===
    if t == "unlock_furniture":
        var furniture_id: String = action.get("furniture_id", "")
        var result: bool = HomeCustomizationManager.unlock_furniture(furniture_id)
        _trace["events"].append({"type": "unlock_furniture", "frame": _frame, "furniture_id": furniture_id, "success": result})
        print("[Scenario] unlock_furniture: %s -> %s" % [furniture_id, str(result)])
        _action_index += 1
        return

    if t == "place_furniture":
        var room_id: String = action.get("room_id", "hero_bedroom")
        var furniture_id: String = action.get("furniture_id", "")
        var pos_x: int = action.get("x", 0)
        var pos_y: int = action.get("y", 0)
        var result: bool = HomeCustomizationManager.place_furniture(room_id, furniture_id, Vector2i(pos_x, pos_y))
        _trace["events"].append({"type": "place_furniture", "frame": _frame, "room_id": room_id, "furniture_id": furniture_id, "x": pos_x, "y": pos_y, "success": result})
        print("[Scenario] place_furniture: %s at (%d,%d) in %s -> %s" % [furniture_id, pos_x, pos_y, room_id, str(result)])
        _action_index += 1
        return

    if t == "check_furniture":
        var unlocked_count: int = HomeCustomizationManager.get_unlocked_count()
        var total_count: int = HomeCustomizationManager.get_total_count()
        _trace["events"].append({"type": "check_furniture", "frame": _frame, "unlocked": unlocked_count, "total": total_count})
        print("[Scenario] check_furniture: %d/%d unlocked" % [unlocked_count, total_count])
        _action_index += 1
        return

    if t == "check_room_placements":
        var room_id: String = action.get("room_id", "hero_bedroom")
        var placements: Array = HomeCustomizationManager.get_room_placements(room_id)
        _trace["events"].append({"type": "check_room_placements", "frame": _frame, "room_id": room_id, "count": placements.size()})
        print("[Scenario] check_room_placements: %s has %d items" % [room_id, placements.size()])
        _action_index += 1
        return

    if t == "clear_room":
        var room_id: String = action.get("room_id", "hero_bedroom")
        HomeCustomizationManager.clear_room(room_id)
        _trace["events"].append({"type": "clear_room", "frame": _frame, "room_id": room_id})
        print("[Scenario] clear_room: %s" % room_id)
        _action_index += 1
        return

    if t == "reset_home_customization":
        HomeCustomizationManager.reset_all()
        _trace["events"].append({"type": "reset_home_customization", "frame": _frame})
        print("[Scenario] reset_home_customization")
        _action_index += 1
        return

    # ── Costume/Outfit Actions ──────────────────────────────────────────────
    if t == "unlock_outfit":
        var outfit_id: String = action.get("outfit_id", "")
        CostumeManager.unlock_outfit(outfit_id)
        _trace["events"].append({"type": "unlock_outfit", "frame": _frame, "outfit_id": outfit_id})
        print("[Scenario] unlock_outfit: %s" % outfit_id)
        _action_index += 1
        return

    if t == "equip_outfit":
        var outfit_id: String = action.get("outfit_id", "")
        var success := CostumeManager.equip_outfit(outfit_id)
        _trace["events"].append({"type": "equip_outfit", "frame": _frame, "outfit_id": outfit_id, "success": success})
        print("[Scenario] equip_outfit: %s (success=%s)" % [outfit_id, success])
        _action_index += 1
        return

    if t == "check_outfit_unlocked":
        var outfit_id: String = action.get("outfit_id", "")
        var is_unlocked := CostumeManager.is_outfit_unlocked(outfit_id)
        _trace["events"].append({"type": "check_outfit_unlocked", "frame": _frame, "outfit_id": outfit_id, "unlocked": is_unlocked})
        print("[Scenario] check_outfit_unlocked: %s = %s" % [outfit_id, is_unlocked])
        _action_index += 1
        return

    if t == "check_equipped_outfit":
        var equipped := CostumeManager.get_equipped_outfit()
        _trace["events"].append({"type": "check_equipped_outfit", "frame": _frame, "equipped": equipped})
        print("[Scenario] check_equipped_outfit: %s" % equipped)
        _action_index += 1
        return

    if t == "check_outfits":
        var unlocked := CostumeManager.get_unlocked_outfits()
        var outfit_ids := []
        for outfit in unlocked:
            outfit_ids.append(outfit.get("id", ""))
        _trace["events"].append({"type": "check_outfits", "frame": _frame, "unlocked_count": unlocked.size(), "outfit_ids": outfit_ids})
        print("[Scenario] check_outfits: %d unlocked (%s)" % [unlocked.size(), ", ".join(outfit_ids)])
        _action_index += 1
        return

    if t == "reset_outfits":
        CostumeManager.reset_unlocks()
        _trace["events"].append({"type": "reset_outfits", "frame": _frame})
        print("[Scenario] reset_outfits")
        _action_index += 1
        return

    if t == "check_outfit_conditions":
        CostumeManager.check_unlock_conditions()
        _trace["events"].append({"type": "check_outfit_conditions", "frame": _frame})
        print("[Scenario] check_outfit_conditions")
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
