extends Node

## AnalyticsManager - Tracks game events for analytics (stub implementation)
## No data is sent - events are logged locally for future backend integration

signal event_logged(event_name: String, properties: Dictionary)
signal session_started(session_id: String)
signal session_ended(session_id: String, duration: float)

# Session tracking
var session_id: String = ""
var session_start_time: float = 0.0
var _is_session_active: bool = false

# Event buffer - stores events for future sending
var _event_buffer: Array[Dictionary] = []
const MAX_BUFFER_SIZE: int = 100

# Standard event types
enum EventType {
    GAME_START,
    GAME_QUIT,
    AREA_ENTER,
    AREA_EXIT,
    BATTLE_START,
    BATTLE_END,
    QUEST_START,
    QUEST_COMPLETE,
    ITEM_ACQUIRED,
    TOOL_ACQUIRED,
    NPC_INTERACT,
    SAVE_GAME,
    LOAD_GAME,
    ACHIEVEMENT_UNLOCK,
    LEVEL_UP,
    CUTSCENE_START,
    CUTSCENE_SKIP,
    CUSTOM
}

func _ready() -> void:
    start_session()
    print("[AnalyticsManager] Initialized (stub mode - no data sent)")

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_CLOSE_REQUEST:
        end_session()

## Start a new analytics session
func start_session() -> void:
    if _is_session_active:
        end_session()
    
    session_id = _generate_session_id()
    session_start_time = Time.get_unix_time_from_system()
    _is_session_active = true
    
    session_started.emit(session_id)
    track_event("session_start", {"session_id": session_id})
    print("[AnalyticsManager] Session started: %s" % session_id)

## End the current session
func end_session() -> void:
    if not _is_session_active:
        return
    
    var duration := Time.get_unix_time_from_system() - session_start_time
    track_event("session_end", {"session_id": session_id, "duration_seconds": duration})
    
    session_ended.emit(session_id, duration)
    print("[AnalyticsManager] Session ended: %s (%.1f seconds)" % [session_id, duration])
    
    _is_session_active = false
    session_id = ""
    session_start_time = 0.0

## Track a custom event
func track_event(event_name: String, properties: Dictionary = {}) -> void:
    var event := {
        "event": event_name,
        "timestamp": Time.get_unix_time_from_system(),
        "session_id": session_id,
        "properties": properties
    }
    
    _event_buffer.append(event)
    if _event_buffer.size() > MAX_BUFFER_SIZE:
        _event_buffer.pop_front()
    
    event_logged.emit(event_name, properties)
    print("[Analytics] %s: %s" % [event_name, properties])

## Convenience methods for standard events
func track_area_enter(area_name: String) -> void:
    track_event("area_enter", {"area": area_name})

func track_area_exit(area_name: String) -> void:
    track_event("area_exit", {"area": area_name})

func track_battle_start(enemy_id: String) -> void:
    track_event("battle_start", {"enemy_id": enemy_id})

func track_battle_end(result: String, enemy_id: String = "") -> void:
    track_event("battle_end", {"result": result, "enemy_id": enemy_id})

func track_quest_start(quest_id: String) -> void:
    track_event("quest_start", {"quest_id": quest_id})

func track_quest_complete(quest_id: String) -> void:
    track_event("quest_complete", {"quest_id": quest_id})

func track_item_acquired(item_id: String, count: int = 1) -> void:
    track_event("item_acquired", {"item_id": item_id, "count": count})

func track_tool_acquired(tool_id: String) -> void:
    track_event("tool_acquired", {"tool_id": tool_id})

func track_npc_interact(npc_id: String) -> void:
    track_event("npc_interact", {"npc_id": npc_id})

func track_save_game(slot: int) -> void:
    track_event("save_game", {"slot": slot})

func track_load_game(slot: int) -> void:
    track_event("load_game", {"slot": slot})

func track_achievement(achievement_id: String) -> void:
    track_event("achievement_unlock", {"achievement_id": achievement_id})

func track_level_up(character_id: String, new_level: int) -> void:
    track_event("level_up", {"character_id": character_id, "level": new_level})

func track_cutscene_start(cutscene_id: String) -> void:
    track_event("cutscene_start", {"cutscene_id": cutscene_id})

func track_cutscene_skip(cutscene_id: String) -> void:
    track_event("cutscene_skip", {"cutscene_id": cutscene_id})

## Get buffered events (for future backend integration)
func get_event_buffer() -> Array[Dictionary]:
    return _event_buffer.duplicate()

func get_event_count() -> int:
    return _event_buffer.size()

func clear_event_buffer() -> void:
    _event_buffer.clear()

## Get session info
func get_session_duration() -> float:
    if not _is_session_active:
        return 0.0
    return Time.get_unix_time_from_system() - session_start_time

func is_session_active() -> bool:
    return _is_session_active

## Generate a unique session ID
func _generate_session_id() -> String:
    var timestamp := int(Time.get_unix_time_from_system())
    var random_part := randi() % 10000
    return "session_%d_%04d" % [timestamp, random_part]

## Stub methods for future backend integration
func flush_to_backend() -> void:
    # Stub: would send _event_buffer to analytics backend
    print("[AnalyticsManager] flush_to_backend() called (stub - no action)")

func set_user_id(user_id: String) -> void:
    # Stub: would associate events with a user ID
    print("[AnalyticsManager] set_user_id(%s) called (stub - no action)" % user_id)

func set_user_property(key: String, value: Variant) -> void:
    # Stub: would set a user property
    print("[AnalyticsManager] set_user_property(%s, %s) called (stub - no action)" % [key, str(value)])

## Save/load for persistence
func get_save_data() -> Dictionary:
    return {
        "event_buffer": _event_buffer,
        "session_id": session_id,
    }

func load_save_data(data: Dictionary) -> void:
    _event_buffer = data.get("event_buffer", [])
