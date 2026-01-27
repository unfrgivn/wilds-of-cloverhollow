extends Node

## UpdateNotificationManager - Checks for app updates (stub for backend integration)

signal update_available(current_version: String, latest_version: String)
signal update_check_completed(update_needed: bool)
signal update_check_failed(error: String)

# Version info
var current_version: String = "1.0.0"
var latest_version: String = "1.0.0"
var _update_available: bool = false
var _last_check_time: int = 0
var _check_interval_seconds: int = 3600  # 1 hour

const UPDATE_STATE_FILE := "user://update_check.json"

func _ready() -> void:
    current_version = ProjectSettings.get_setting("application/config/version", "1.0.0")
    _load_state()
    print("[UpdateNotificationManager] Initialized - v%s" % current_version)

## Check for updates (stub - returns false)
func check_for_update() -> bool:
    print("[UpdateNotificationManager] Checking for updates (stub)...")
    
    # Stub: In production, this would fetch from a backend
    # For now, simulate no updates available
    latest_version = current_version
    _update_available = false
    _last_check_time = int(Time.get_unix_time_from_system())
    
    _save_state()
    update_check_completed.emit(_update_available)
    
    return _update_available

## Simulate an update being available (for testing)
func simulate_update_available(new_version: String) -> void:
    latest_version = new_version
    _update_available = _compare_versions(current_version, latest_version) < 0
    
    if _update_available:
        update_available.emit(current_version, latest_version)
        print("[UpdateNotificationManager] Update available: v%s -> v%s" % [current_version, latest_version])

## Clear simulated update state
func clear_update_state() -> void:
    latest_version = current_version
    _update_available = false
    _save_state()
    print("[UpdateNotificationManager] Update state cleared")

## Check if an update is available
func is_update_available() -> bool:
    return _update_available

## Get time since last check
func get_time_since_check() -> int:
    if _last_check_time == 0:
        return -1
    return int(Time.get_unix_time_from_system()) - _last_check_time

## Should we auto-check (based on interval)
func should_auto_check() -> bool:
    var time_since := get_time_since_check()
    if time_since < 0:
        return true  # Never checked
    return time_since >= _check_interval_seconds

## Open store URL (stub)
func open_store() -> void:
    # Stub: In production, opens App Store URL
    print("[UpdateNotificationManager] Would open App Store (stub)")
    # OS.shell_open("https://apps.apple.com/app/wilds-of-cloverhollow")

## Compare version strings (returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2)
func _compare_versions(v1: String, v2: String) -> int:
    var parts1 := v1.split(".")
    var parts2 := v2.split(".")
    
    var max_len: int = max(parts1.size(), parts2.size())
    
    for i in range(max_len):
        var n1: int = int(parts1[i]) if i < parts1.size() else 0
        var n2: int = int(parts2[i]) if i < parts2.size() else 0
        
        if n1 < n2:
            return -1
        elif n1 > n2:
            return 1
    
    return 0

## Save state to disk
func _save_state() -> void:
    var data := {
        "last_check_time": _last_check_time,
        "latest_version": latest_version
    }
    
    var file := FileAccess.open(UPDATE_STATE_FILE, FileAccess.WRITE)
    if file != null:
        file.store_string(JSON.stringify(data, "\t"))
        file.close()

## Load state from disk
func _load_state() -> void:
    if not FileAccess.file_exists(UPDATE_STATE_FILE):
        return
    
    var file := FileAccess.open(UPDATE_STATE_FILE, FileAccess.READ)
    if file == null:
        return
    
    var json := JSON.new()
    if json.parse(file.get_as_text()) == OK:
        var data = json.get_data()
        if data is Dictionary:
            _last_check_time = data.get("last_check_time", 0)
            latest_version = data.get("latest_version", current_version)
            _update_available = _compare_versions(current_version, latest_version) < 0
    
    file.close()
