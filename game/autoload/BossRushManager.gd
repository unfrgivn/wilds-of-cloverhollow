extends Node
## BossRushManager — Handles Boss Rush mode, a challenge mode with sequential boss fights.
##
## Features:
## - Sequential boss fights without healing between battles
## - Timer tracking for speedrun leaderboard
## - Local leaderboard with best times

signal boss_rush_started
signal boss_rush_ended(victory: bool, time: float, bosses_defeated: int)
signal boss_defeated(boss_index: int, boss_id: String)
signal leaderboard_updated(entries: Array)

const LEADERBOARD_FILE: String = "user://boss_rush_leaderboard.json"
const MAX_LEADERBOARD_ENTRIES: int = 10

# Boss lineup for rush mode
const BOSS_LINEUP: Array[String] = [
    "forest_guardian",
    "chaos_minion"
]

var _is_active: bool = false
var _current_boss_index: int = 0
var _start_time: float = 0.0
var _elapsed_time: float = 0.0
var _leaderboard: Array = []


func _ready() -> void:
    _load_leaderboard()


## Start a new boss rush attempt
func start_boss_rush() -> void:
    _is_active = true
    _current_boss_index = 0
    _start_time = Time.get_unix_time_from_system()
    _elapsed_time = 0.0
    
    boss_rush_started.emit()
    print("[BossRushManager] Boss Rush started!")
    
    # Start first boss
    _start_current_boss()


## Check if boss rush is active
func is_active() -> bool:
    return _is_active


## Get current boss index
func get_current_boss_index() -> int:
    return _current_boss_index


## Get total boss count
func get_total_bosses() -> int:
    return BOSS_LINEUP.size()


## Get current boss ID
func get_current_boss_id() -> String:
    if _current_boss_index < BOSS_LINEUP.size():
        return BOSS_LINEUP[_current_boss_index]
    return ""


## Called when player defeats current boss
func report_boss_defeated() -> void:
    if not _is_active:
        return
    
    var defeated_boss: String = get_current_boss_id()
    boss_defeated.emit(_current_boss_index, defeated_boss)
    print("[BossRushManager] Boss defeated: %s (%d/%d)" % [defeated_boss, _current_boss_index + 1, get_total_bosses()])
    
    _current_boss_index += 1
    
    if _current_boss_index >= BOSS_LINEUP.size():
        _complete_boss_rush(true)
    else:
        _start_current_boss()


## Called when player loses a battle
func report_defeat() -> void:
    if not _is_active:
        return
    
    _complete_boss_rush(false)


func _start_current_boss() -> void:
    var boss_id: String = get_current_boss_id()
    print("[BossRushManager] Starting boss: %s" % boss_id)
    
    # Trigger battle via BattleManager if available
    if has_node("/root/BattleManager"):
        var battle = get_node("/root/BattleManager")
        if battle.has_method("start_boss_battle"):
            battle.start_boss_battle(boss_id)
        else:
            # Fallback to regular battle
            battle.start_battle({"enemy_id": boss_id, "enemy_name": boss_id})


func _complete_boss_rush(victory: bool) -> void:
    _elapsed_time = Time.get_unix_time_from_system() - _start_time
    _is_active = false
    
    if victory:
        _add_leaderboard_entry(_elapsed_time, _current_boss_index)
        print("[BossRushManager] Boss Rush completed! Time: %.2f seconds" % _elapsed_time)
    else:
        print("[BossRushManager] Boss Rush failed at boss %d" % (_current_boss_index + 1))
    
    boss_rush_ended.emit(victory, _elapsed_time, _current_boss_index)


## Get elapsed time (live during rush, final after completion)
func get_elapsed_time() -> float:
    if _is_active:
        return Time.get_unix_time_from_system() - _start_time
    return _elapsed_time


## Format time for display (MM:SS.mmm)
func format_time(seconds: float) -> String:
    var mins: int = int(seconds) / 60
    var secs: int = int(seconds) % 60
    var millis: int = int((seconds - int(seconds)) * 1000)
    return "%02d:%02d.%03d" % [mins, secs, millis]


## Get leaderboard entries
func get_leaderboard() -> Array:
    return _leaderboard.duplicate()


## Add entry to leaderboard
func _add_leaderboard_entry(time: float, bosses: int) -> void:
    var entry: Dictionary = {
        "time": time,
        "bosses": bosses,
        "date": Time.get_datetime_string_from_system()
    }
    
    _leaderboard.append(entry)
    
    # Sort by time (ascending)
    _leaderboard.sort_custom(func(a, b): return a["time"] < b["time"])
    
    # Trim to max entries
    if _leaderboard.size() > MAX_LEADERBOARD_ENTRIES:
        _leaderboard.resize(MAX_LEADERBOARD_ENTRIES)
    
    _save_leaderboard()
    leaderboard_updated.emit(_leaderboard)


## Clear leaderboard (for testing)
func clear_leaderboard() -> void:
    _leaderboard.clear()
    _save_leaderboard()
    leaderboard_updated.emit(_leaderboard)


## Reset boss rush state (for testing)
func reset() -> void:
    _is_active = false
    _current_boss_index = 0
    _elapsed_time = 0.0


func _save_leaderboard() -> void:
    var file := FileAccess.open(LEADERBOARD_FILE, FileAccess.WRITE)
    if file:
        file.store_string(JSON.stringify(_leaderboard))
        file.close()


func _load_leaderboard() -> void:
    if not FileAccess.file_exists(LEADERBOARD_FILE):
        return
    var file := FileAccess.open(LEADERBOARD_FILE, FileAccess.READ)
    if file:
        var json := JSON.new()
        if json.parse(file.get_as_text()) == OK:
            _leaderboard = json.data
        file.close()


## Get save data for persistence
func get_save_data() -> Dictionary:
    return {}  # Boss rush state is session-only, leaderboard persists separately


## Load save data
func load_save_data(_data: Dictionary) -> void:
    pass  # Boss rush state is session-only
