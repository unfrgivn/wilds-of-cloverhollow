extends Node
## SpeedrunManager autoload.
## Tracks real-time game timer for speedruns with split times.

signal timer_started
signal timer_stopped(total_time: float)
signal timer_reset
signal split_recorded(split_name: String, time: float)
signal speedrun_mode_changed(enabled: bool)

# Timer state
var is_running: bool = false
var elapsed_time: float = 0.0
var start_timestamp: float = 0.0

# Split tracking
var splits: Array[Dictionary] = []  # Array of {name, time}
var split_names: Array[String] = [
    "forest_unlocked",
    "clubhouse_found",
    "villain_revealed",
    "party_formed",
    "demo_complete",
]


func _ready() -> void:
    print("[SpeedrunManager] Ready")


func _process(delta: float) -> void:
    if is_running:
        elapsed_time = Time.get_unix_time_from_system() - start_timestamp


func start_timer() -> void:
    if is_running:
        return
    is_running = true
    start_timestamp = Time.get_unix_time_from_system()
    elapsed_time = 0.0
    splits.clear()
    timer_started.emit()
    print("[SpeedrunManager] Timer started")


func stop_timer() -> void:
    if not is_running:
        return
    is_running = false
    timer_stopped.emit(elapsed_time)
    print("[SpeedrunManager] Timer stopped: %s" % format_time(elapsed_time))


func reset_timer() -> void:
    is_running = false
    elapsed_time = 0.0
    start_timestamp = 0.0
    splits.clear()
    timer_reset.emit()
    print("[SpeedrunManager] Timer reset")


func record_split(split_name: String) -> void:
    if not is_running:
        return
    # Don't duplicate splits
    for split in splits:
        if split.name == split_name:
            return
    var split_data := {"name": split_name, "time": elapsed_time}
    splits.append(split_data)
    split_recorded.emit(split_name, elapsed_time)
    print("[SpeedrunManager] Split '%s': %s" % [split_name, format_time(elapsed_time)])


func get_elapsed_time() -> float:
    return elapsed_time


func get_splits() -> Array[Dictionary]:
    return splits


func get_split_time(split_name: String) -> float:
    for split in splits:
        if split.name == split_name:
            return split.time
    return -1.0


func format_time(time: float) -> String:
    var minutes := int(time / 60.0)
    var seconds := int(time) % 60
    var milliseconds := int((time - int(time)) * 1000)
    return "%02d:%02d.%03d" % [minutes, seconds, milliseconds]


func is_speedrun_mode() -> bool:
    return SettingsManager.speedrun_mode_enabled


func get_save_data() -> Dictionary:
    return {
        "is_running": is_running,
        "elapsed_time": elapsed_time,
        "start_timestamp": start_timestamp,
        "splits": splits.duplicate(true),
    }


func load_save_data(data: Dictionary) -> void:
    is_running = data.get("is_running", false)
    elapsed_time = data.get("elapsed_time", 0.0)
    start_timestamp = data.get("start_timestamp", 0.0)
    splits.clear()
    var loaded_splits: Array = data.get("splits", [])
    for split in loaded_splits:
        splits.append(split)
