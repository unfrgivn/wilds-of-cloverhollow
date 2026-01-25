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

func _step_actions() -> void:
    if _action_index >= _actions.size():
        return

    var action = _actions[_action_index]
    if typeof(action) != TYPE_DICTIONARY or not action.has("type"):
        _trace["events"].append({"type": "error", "frame": _frame, "msg": "Action missing type."})
        _action_index += 1
        return

    var t: String = str(action["type"])

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
