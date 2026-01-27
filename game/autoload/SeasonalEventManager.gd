extends Node
## SeasonalEventManager - Handles date-based seasonal events

signal event_started(event_id: String, event_data: Dictionary)
signal event_ended(event_id: String)
signal active_events_changed(active_events: Array)

var _events_data: Array = []
var _active_events: Array = []  # Array of event IDs currently active
var _override_date: Dictionary = {}  # For testing: {month: int, day: int}

func _ready() -> void:
    _load_events_data()
    _check_active_events()

func _load_events_data() -> void:
    var file := FileAccess.open("res://game/data/events/seasonal_events.json", FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            _events_data = json.data.get("events", [])
    else:
        push_warning("[SeasonalEventManager] Could not load seasonal events data")

func _check_active_events() -> void:
    var date := _get_current_date()
    var month: int = date.get("month", 1)
    var day: int = date.get("day", 1)
    
    var new_active: Array = []
    for event in _events_data:
        if _is_event_active(event, month, day):
            new_active.append(event.get("id", ""))
    
    # Check for changes
    var events_changed := false
    for event_id in new_active:
        if event_id not in _active_events:
            events_changed = true
            var event_data := get_event_data(event_id)
            event_started.emit(event_id, event_data)
    
    for event_id in _active_events:
        if event_id not in new_active:
            events_changed = true
            event_ended.emit(event_id)
    
    if events_changed:
        _active_events = new_active
        active_events_changed.emit(_active_events)

func _is_event_active(event: Dictionary, month: int, day: int) -> bool:
    var start_month: int = event.get("start_month", 1)
    var start_day: int = event.get("start_day", 1)
    var end_month: int = event.get("end_month", 12)
    var end_day: int = event.get("end_day", 31)
    
    # Handle events that wrap around the year (e.g., Dec 15 - Jan 5)
    if start_month > end_month:
        # Either we're in the end-of-year portion OR the start-of-year portion
        if month > start_month or (month == start_month and day >= start_day):
            return true
        if month < end_month or (month == end_month and day <= end_day):
            return true
        return false
    else:
        # Normal case: start and end in same year
        var after_start := month > start_month or (month == start_month and day >= start_day)
        var before_end := month < end_month or (month == end_month and day <= end_day)
        return after_start and before_end

func _get_current_date() -> Dictionary:
    if _override_date.size() > 0:
        return _override_date
    
    var datetime := Time.get_datetime_dict_from_system()
    return {"month": datetime.get("month", 1), "day": datetime.get("day", 1)}

# ---- Public API ----

func get_all_events() -> Array:
    return _events_data.duplicate()

func get_event_data(event_id: String) -> Dictionary:
    for event in _events_data:
        if event.get("id") == event_id:
            return event
    return {}

func get_active_events() -> Array:
    return _active_events.duplicate()

func is_event_active(event_id: String) -> bool:
    return event_id in _active_events

func get_active_event_data() -> Array:
    ## Returns full event data for all active events
    var result: Array = []
    for event_id in _active_events:
        var data := get_event_data(event_id)
        if data.size() > 0:
            result.append(data)
    return result

func set_override_date(month: int, day: int) -> void:
    ## For testing: override the current date
    _override_date = {"month": month, "day": day}
    _check_active_events()

func clear_override_date() -> void:
    _override_date.clear()
    _check_active_events()

func refresh_events() -> void:
    ## Force re-check of active events
    _check_active_events()

# ---- Save/Load Integration ----

func get_save_data() -> Dictionary:
    return {
        "override_date": _override_date.duplicate()
    }

func load_save_data(data: Dictionary) -> void:
    _override_date = data.get("override_date", {})
    _check_active_events()
