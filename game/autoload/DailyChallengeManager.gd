extends Node
## DailyChallengeManager - Handles daily rotating challenges with rewards

signal challenge_updated(challenge_id: String, current: int, target: int)
signal challenge_completed(challenge_id: String, reward_gold: int)
signal daily_challenges_refreshed(challenges: Array)

const SAVE_PATH := "user://daily_challenges.json"

var _challenges_data: Array = []
var _daily_count: int = 3
var _active_challenges: Array = []  # Array of challenge IDs for today
var _progress: Dictionary = {}  # {challenge_id: current_count}
var _completed: Array = []  # Array of completed challenge IDs
var _last_refresh_day: int = -1
var _override_day: int = -1  # For testing

func _ready() -> void:
    _load_challenges_data()
    _load_progress()
    _check_daily_refresh()

func _load_challenges_data() -> void:
    var file := FileAccess.open("res://game/data/challenges/daily_challenges.json", FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            _challenges_data = json.data.get("challenges", [])
            _daily_count = json.data.get("daily_count", 3)
    else:
        push_warning("[DailyChallengeManager] Could not load daily challenges data")

func _load_progress() -> void:
    var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            var data: Dictionary = json.data
            _active_challenges = data.get("active_challenges", [])
            _progress = data.get("progress", {})
            _completed = data.get("completed", [])
            _last_refresh_day = data.get("last_refresh_day", -1)

func save_progress() -> void:
    var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
    if file:
        var data := {
            "active_challenges": _active_challenges,
            "progress": _progress,
            "completed": _completed,
            "last_refresh_day": _last_refresh_day
        }
        file.store_string(JSON.stringify(data, "  "))
        file.close()

func _check_daily_refresh() -> void:
    var current_day := _get_current_day()
    if current_day != _last_refresh_day:
        _refresh_daily_challenges()

func _refresh_daily_challenges() -> void:
    _last_refresh_day = _get_current_day()
    _active_challenges.clear()
    _progress.clear()
    _completed.clear()
    
    # Pick random challenges for today
    var available := _challenges_data.duplicate()
    available.shuffle()
    
    var count := mini(_daily_count, available.size())
    for i in range(count):
        var challenge: Dictionary = available[i]
        var challenge_id: String = challenge.get("id", "")
        _active_challenges.append(challenge_id)
        _progress[challenge_id] = 0
    
    save_progress()
    daily_challenges_refreshed.emit(_active_challenges)

func _get_current_day() -> int:
    if _override_day >= 0:
        return _override_day
    
    var datetime := Time.get_datetime_dict_from_system()
    # Use day-of-year for daily rotation
    return datetime.get("year", 2026) * 1000 + datetime.get("day", 1)

# ---- Public API ----

func get_all_challenges() -> Array:
    return _challenges_data.duplicate()

func get_challenge_data(challenge_id: String) -> Dictionary:
    for challenge in _challenges_data:
        if challenge.get("id") == challenge_id:
            return challenge
    return {}

func get_active_challenges() -> Array:
    ## Returns array of challenge data for today's active challenges
    var result: Array = []
    for challenge_id in _active_challenges:
        var data := get_challenge_data(challenge_id)
        if data.size() > 0:
            var entry := data.duplicate()
            entry["progress"] = _progress.get(challenge_id, 0)
            entry["is_completed"] = challenge_id in _completed
            result.append(entry)
    return result

func get_challenge_progress(challenge_id: String) -> int:
    return _progress.get(challenge_id, 0)

func is_challenge_active(challenge_id: String) -> bool:
    return challenge_id in _active_challenges

func is_challenge_completed(challenge_id: String) -> bool:
    return challenge_id in _completed

func record_progress(challenge_type: String, amount: int = 1) -> void:
    ## Record progress towards challenges of a specific type
    for challenge_id in _active_challenges:
        if challenge_id in _completed:
            continue
        
        var data := get_challenge_data(challenge_id)
        if data.get("type") == challenge_type:
            var current: int = _progress.get(challenge_id, 0)
            var target: int = data.get("target_count", 1)
            current = mini(current + amount, target)
            _progress[challenge_id] = current
            
            challenge_updated.emit(challenge_id, current, target)
            
            if current >= target:
                _complete_challenge(challenge_id)
            else:
                save_progress()

func _complete_challenge(challenge_id: String) -> void:
    if challenge_id in _completed:
        return
    
    _completed.append(challenge_id)
    var data := get_challenge_data(challenge_id)
    var reward_gold: int = data.get("reward_gold", 0)
    
    # TODO: Actually grant rewards via InventoryManager
    # InventoryManager.add_gold(reward_gold)
    # for item in data.get("reward_items", []):
    #     InventoryManager.add_item(item.get("id"), item.get("count", 1))
    
    save_progress()
    challenge_completed.emit(challenge_id, reward_gold)

func force_refresh() -> void:
    ## Force refresh daily challenges (for testing)
    _refresh_daily_challenges()

func set_override_day(day: int) -> void:
    ## For testing: override the current day number
    _override_day = day
    _check_daily_refresh()

func clear_override_day() -> void:
    _override_day = -1
    _check_daily_refresh()

# ---- Save/Load Integration ----

func get_save_data() -> Dictionary:
    return {
        "active_challenges": _active_challenges.duplicate(),
        "progress": _progress.duplicate(),
        "completed": _completed.duplicate(),
        "last_refresh_day": _last_refresh_day
    }

func load_save_data(data: Dictionary) -> void:
    _active_challenges = data.get("active_challenges", [])
    _progress = data.get("progress", {})
    _completed = data.get("completed", [])
    _last_refresh_day = data.get("last_refresh_day", -1)

func reset_progress() -> void:
    _active_challenges.clear()
    _progress.clear()
    _completed.clear()
    _last_refresh_day = -1
    _override_day = -1
    save_progress()
