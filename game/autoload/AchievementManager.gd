extends Node
## Global achievement manager - handles achievement tracking and unlocking
## Supports trigger events, progress tracking, and persistence

signal achievement_unlocked(achievement_id: String, achievement_data: Dictionary)
signal achievement_progress(achievement_id: String, current: int, target: int)

var _achievement_data: Dictionary = {}
var _unlocked_achievements: Dictionary = {}  # achievement_id -> unlock_timestamp
var _progress_data: Dictionary = {}  # trigger_type -> count
var _achievement_popup_ui: Node = null
var _save_file_path: String = "user://achievements.json"


func _ready() -> void:
    _load_achievement_data()
    _load_unlocked_achievements()
    _connect_game_signals()


func _load_achievement_data() -> void:
    var file_path := "res://game/data/achievements/achievements.json"
    if not FileAccess.file_exists(file_path):
        push_warning("AchievementManager: Achievement data file not found: " + file_path)
        return
    
    var file := FileAccess.open(file_path, FileAccess.READ)
    if file == null:
        push_warning("AchievementManager: Could not open achievement data file")
        return
    
    var json_text := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var parse_result := json.parse(json_text)
    if parse_result != OK:
        push_warning("AchievementManager: Failed to parse achievement data JSON")
        return
    
    var data = json.data
    if data is Dictionary and data.has("achievements"):
        _achievement_data = data["achievements"]


func _load_unlocked_achievements() -> void:
    if not FileAccess.file_exists(_save_file_path):
        return
    
    var file := FileAccess.open(_save_file_path, FileAccess.READ)
    if file == null:
        return
    
    var json_text := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var parse_result := json.parse(json_text)
    if parse_result != OK:
        return
    
    var data = json.data
    if data is Dictionary:
        if data.has("unlocked"):
            _unlocked_achievements = data["unlocked"]
        if data.has("progress"):
            _progress_data = data["progress"]


func _save_unlocked_achievements() -> void:
    var data := {
        "unlocked": _unlocked_achievements,
        "progress": _progress_data
    }
    
    var file := FileAccess.open(_save_file_path, FileAccess.WRITE)
    if file == null:
        push_warning("AchievementManager: Could not save achievements")
        return
    
    file.store_string(JSON.stringify(data, "\t"))
    file.close()


func _connect_game_signals() -> void:
    # Connect to relevant game managers for automatic triggers
    # These are stubbed out - in real implementation would connect to:
    # - QuestManager for quest completions
    # - BattleManager for battle wins
    # - PhotoModeManager for photo taken
    # - InventoryManager for tool acquisition
    # - SceneRouter for area visits
    pass


## Register the achievement popup UI instance
func register_popup_ui(ui: Node) -> void:
    _achievement_popup_ui = ui


## Get achievement by ID
func get_achievement(achievement_id: String) -> Dictionary:
    if _achievement_data.has(achievement_id):
        return _achievement_data[achievement_id]
    return {}


## Get all achievement IDs
func get_all_achievement_ids() -> Array:
    return _achievement_data.keys()


## Get all unlocked achievement IDs
func get_unlocked_achievement_ids() -> Array:
    return _unlocked_achievements.keys()


## Check if achievement is unlocked
func is_unlocked(achievement_id: String) -> bool:
    return _unlocked_achievements.has(achievement_id)


## Unlock an achievement by ID
func unlock_achievement(achievement_id: String) -> bool:
    if is_unlocked(achievement_id):
        return false  # Already unlocked
    
    var achievement := get_achievement(achievement_id)
    if achievement.is_empty():
        push_warning("AchievementManager: Achievement not found: " + achievement_id)
        return false
    
    _unlocked_achievements[achievement_id] = int(Time.get_unix_time_from_system())
    _save_unlocked_achievements()
    
    print("[Achievement] Unlocked: %s - %s" % [achievement.get("name", achievement_id), achievement.get("description", "")])
    
    # Show popup if available
    if _achievement_popup_ui != null:
        _achievement_popup_ui.show_achievement(achievement)
    
    achievement_unlocked.emit(achievement_id, achievement)
    return true


## Record progress for a trigger type and check for unlocks
func record_progress(trigger_type: String, amount: int = 1) -> void:
    if not _progress_data.has(trigger_type):
        _progress_data[trigger_type] = 0
    
    _progress_data[trigger_type] += amount
    var current: int = _progress_data[trigger_type]
    
    _save_unlocked_achievements()
    
    # Check all achievements with this trigger
    for achievement_id in _achievement_data.keys():
        var achievement: Dictionary = _achievement_data[achievement_id]
        var ach_trigger: String = achievement.get("trigger", "")
        
        if ach_trigger != trigger_type:
            continue
        
        if is_unlocked(achievement_id):
            continue
        
        var target: int = achievement.get("trigger_value", 1)
        
        achievement_progress.emit(achievement_id, current, target)
        
        if current >= target:
            unlock_achievement(achievement_id)


## Get current progress for a trigger type
func get_progress(trigger_type: String) -> int:
    return _progress_data.get(trigger_type, 0)


## Get total achievement points
func get_total_points() -> int:
    var total := 0
    for achievement_id in _unlocked_achievements.keys():
        var achievement := get_achievement(achievement_id)
        total += achievement.get("points", 0)
    return total


## Get max possible achievement points
func get_max_points() -> int:
    var total := 0
    for achievement_id in _achievement_data.keys():
        var achievement: Dictionary = _achievement_data[achievement_id]
        total += achievement.get("points", 0)
    return total


## Reset all achievements (for testing/debugging)
func reset_all() -> void:
    _unlocked_achievements.clear()
    _progress_data.clear()
    _save_unlocked_achievements()


## Get save data for SaveManager integration
func get_save_data() -> Dictionary:
    return {
        "unlocked": _unlocked_achievements.duplicate(),
        "progress": _progress_data.duplicate()
    }


## Load save data for SaveManager integration
func load_save_data(data: Dictionary) -> void:
    if data.has("unlocked"):
        _unlocked_achievements = data["unlocked"]
    if data.has("progress"):
        _progress_data = data["progress"]
