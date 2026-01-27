extends Node
## Community event framework for time-limited events.
##
## Manages scheduling, progress tracking, and rewards for
## community-wide time-limited events.

# ── Signals ──────────────────────────────────────────────────────────────────
signal event_started(event_id: String, event_data: Dictionary)
signal event_ended(event_id: String)
signal event_progress_updated(event_id: String, progress: int, target: int)
signal event_reward_claimed(event_id: String, reward: Dictionary)
signal events_refreshed(active_events: Array)

# ── Constants ────────────────────────────────────────────────────────────────
const EVENTS_PATH: String = "res://game/data/events/community_events.json"
const SAVE_PATH: String = "user://community_events.json"

# ── State ────────────────────────────────────────────────────────────────────
var _events_data: Array = []
var _active_events: Dictionary = {}  # event_id -> {progress, claimed, joined_at}
var _override_timestamp: int = 0  # For testing


# ── Lifecycle ────────────────────────────────────────────────────────────────
func _ready() -> void:
    _load_events_data()
    _load_state()
    _refresh_active_events()


# ── Data Loading ─────────────────────────────────────────────────────────────
func _load_events_data() -> void:
    if not FileAccess.file_exists(EVENTS_PATH):
        push_warning("[CommunityEventManager] No events data file found")
        return
    
    var file := FileAccess.open(EVENTS_PATH, FileAccess.READ)
    if file == null:
        push_error("[CommunityEventManager] Failed to open events data")
        return
    
    var json := JSON.new()
    var err := json.parse(file.get_as_text())
    file.close()
    
    if err != OK:
        push_error("[CommunityEventManager] Failed to parse events data: %s" % json.get_error_message())
        return
    
    var data: Dictionary = json.data
    _events_data = data.get("events", [])


# ── Event Queries ────────────────────────────────────────────────────────────
func get_all_events() -> Array:
    return _events_data.duplicate()


func get_event(event_id: String) -> Dictionary:
    for event in _events_data:
        if event.get("id") == event_id:
            return event
    return {}


func get_active_events() -> Array:
    ## Returns events currently running based on timestamp.
    var result: Array = []
    var now: int = _get_current_timestamp()
    
    for event in _events_data:
        var start_ts: int = event.get("start_timestamp", 0)
        var end_ts: int = event.get("end_timestamp", 0)
        
        if now >= start_ts and now < end_ts:
            var event_copy: Dictionary = event.duplicate()
            event_copy["time_remaining"] = end_ts - now
            event_copy["player_progress"] = get_event_progress(event.get("id", ""))
            result.append(event_copy)
    
    return result


func is_event_active(event_id: String) -> bool:
    var event: Dictionary = get_event(event_id)
    if event.is_empty():
        return false
    
    var now: int = _get_current_timestamp()
    var start_ts: int = event.get("start_timestamp", 0)
    var end_ts: int = event.get("end_timestamp", 0)
    
    return now >= start_ts and now < end_ts


func get_event_progress(event_id: String) -> int:
    if _active_events.has(event_id):
        return _active_events[event_id].get("progress", 0)
    return 0


func is_event_joined(event_id: String) -> bool:
    return _active_events.has(event_id)


func is_reward_claimed(event_id: String) -> bool:
    if _active_events.has(event_id):
        return _active_events[event_id].get("claimed", false)
    return false


# ── Event Participation ──────────────────────────────────────────────────────
func join_event(event_id: String) -> bool:
    ## Join an active event to start tracking progress.
    if not is_event_active(event_id):
        push_warning("[CommunityEventManager] Cannot join inactive event: %s" % event_id)
        return false
    
    if is_event_joined(event_id):
        return true  # Already joined
    
    _active_events[event_id] = {
        "progress": 0,
        "claimed": false,
        "joined_at": _get_current_timestamp()
    }
    
    var event: Dictionary = get_event(event_id)
    event_started.emit(event_id, event)
    _save_state()
    return true


func record_progress(event_id: String, amount: int = 1) -> void:
    ## Record progress towards an event goal.
    if not is_event_joined(event_id):
        return
    
    if not is_event_active(event_id):
        return
    
    var event: Dictionary = get_event(event_id)
    var target: int = event.get("target_count", 100)
    
    var current: int = _active_events[event_id].get("progress", 0)
    var new_progress: int = mini(current + amount, target)
    _active_events[event_id]["progress"] = new_progress
    
    event_progress_updated.emit(event_id, new_progress, target)
    _save_state()


func claim_reward(event_id: String) -> Dictionary:
    ## Claim reward for completing an event.
    if not is_event_joined(event_id):
        return {}
    
    if is_reward_claimed(event_id):
        return {}
    
    var event: Dictionary = get_event(event_id)
    var target: int = event.get("target_count", 100)
    var progress: int = get_event_progress(event_id)
    
    if progress < target:
        push_warning("[CommunityEventManager] Event not complete: %s (%d/%d)" % [event_id, progress, target])
        return {}
    
    var reward: Dictionary = {
        "gold": event.get("reward_gold", 0),
        "items": event.get("reward_items", [])
    }
    
    _active_events[event_id]["claimed"] = true
    
    # Grant rewards
    if reward.get("gold", 0) > 0 and PartyManager:
        PartyManager.add_gold(reward.get("gold", 0))
    
    for item in reward.get("items", []):
        if InventoryManager:
            InventoryManager.add_item(item.get("id", ""), item.get("count", 1))
    
    event_reward_claimed.emit(event_id, reward)
    _save_state()
    return reward


# ── Time Management ──────────────────────────────────────────────────────────
func set_override_timestamp(timestamp: int) -> void:
    ## Override current time for testing.
    _override_timestamp = timestamp
    _refresh_active_events()


func clear_override_timestamp() -> void:
    _override_timestamp = 0
    _refresh_active_events()


func get_time_remaining(event_id: String) -> int:
    ## Returns seconds remaining for an event, or 0 if inactive.
    var event: Dictionary = get_event(event_id)
    if event.is_empty():
        return 0
    
    var end_ts: int = event.get("end_timestamp", 0)
    var now: int = _get_current_timestamp()
    
    return maxi(0, end_ts - now)


func format_time_remaining(seconds: int) -> String:
    if seconds <= 0:
        return "Ended"
    
    var days: int = seconds / 86400
    var hours: int = (seconds % 86400) / 3600
    var mins: int = (seconds % 3600) / 60
    
    if days > 0:
        return "%dd %dh" % [days, hours]
    elif hours > 0:
        return "%dh %dm" % [hours, mins]
    else:
        return "%dm" % mins


# ── Persistence ──────────────────────────────────────────────────────────────
func _save_state() -> void:
    var data: Dictionary = {
        "active_events": _active_events
    }
    
    var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
    if file:
        file.store_string(JSON.stringify(data, "  "))
        file.close()


func _load_state() -> void:
    if not FileAccess.file_exists(SAVE_PATH):
        return
    
    var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
    if file == null:
        return
    
    var json := JSON.new()
    var err := json.parse(file.get_as_text())
    file.close()
    
    if err != OK:
        return
    
    var data: Dictionary = json.data
    _active_events = data.get("active_events", {})


func get_save_data() -> Dictionary:
    return {
        "active_events": _active_events
    }


func load_save_data(data: Dictionary) -> void:
    _active_events = data.get("active_events", {})


func reset() -> void:
    _active_events.clear()
    _override_timestamp = 0
    _save_state()


# ── Internal ─────────────────────────────────────────────────────────────────
func _get_current_timestamp() -> int:
    if _override_timestamp > 0:
        return _override_timestamp
    return int(Time.get_unix_time_from_system())


func _refresh_active_events() -> void:
    var active: Array = get_active_events()
    events_refreshed.emit(active)
    
    # Check for ended events
    var now: int = _get_current_timestamp()
    for event_id in _active_events.keys():
        var event: Dictionary = get_event(event_id)
        if event.is_empty():
            continue
        
        var end_ts: int = event.get("end_timestamp", 0)
        if now >= end_ts:
            event_ended.emit(event_id)
