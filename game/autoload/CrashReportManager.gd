extends Node

## CrashReportManager - Exception handling and crash reporting (stub implementation)
## Logs errors to file for debugging. Upload hook is a no-op for future backend.

signal error_logged(error_data: Dictionary)
signal crash_report_uploaded(success: bool)

const LOG_FILE_PATH := "user://crash_reports/error_log.txt"
const MAX_LOG_SIZE := 1024 * 1024  # 1MB max log size
const MAX_REPORTS := 50

# Error tracking
var _error_buffer: Array[Dictionary] = []
var _crash_report_id: int = 0

func _ready() -> void:
    _ensure_log_directory()
    _connect_error_signals()
    _log_session_start()
    print("[CrashReportManager] Initialized (stub mode - no uploads)")

func _ensure_log_directory() -> void:
    var dir := DirAccess.open("user://")
    if dir and not dir.dir_exists("crash_reports"):
        dir.make_dir("crash_reports")

func _connect_error_signals() -> void:
    # In Godot 4, we can't directly catch all errors, but we can log push_error messages
    # by overriding _notification for NOTIFICATION_PREDELETE etc.
    pass

func _log_session_start() -> void:
    log_event("SESSION_START", {
        "timestamp": Time.get_datetime_string_from_system(),
        "platform": OS.get_name(),
        "version": ProjectSettings.get_setting("application/config/version", "unknown"),
        "godot_version": Engine.get_version_info().string
    })

func _notification(what: int) -> void:
    if what == NOTIFICATION_WM_CLOSE_REQUEST:
        log_event("SESSION_END", {"timestamp": Time.get_datetime_string_from_system()})

## Log an error or event
func log_error(error_message: String, error_type: String = "ERROR", stack_trace: String = "") -> void:
    var error_data := {
        "id": _crash_report_id,
        "type": error_type,
        "message": error_message,
        "timestamp": Time.get_datetime_string_from_system(),
        "unix_time": Time.get_unix_time_from_system(),
        "stack_trace": stack_trace if stack_trace != "" else _get_stack_trace()
    }
    
    _crash_report_id += 1
    _error_buffer.append(error_data)
    
    if _error_buffer.size() > MAX_REPORTS:
        _error_buffer.pop_front()
    
    _write_to_log(error_data)
    error_logged.emit(error_data)
    
    print("[CrashReport] %s: %s" % [error_type, error_message])

## Log a general event (not necessarily an error)
func log_event(event_type: String, properties: Dictionary = {}) -> void:
    var event_data := {
        "type": event_type,
        "timestamp": Time.get_datetime_string_from_system(),
        "properties": properties
    }
    _write_to_log(event_data)

## Log a warning
func log_warning(message: String) -> void:
    log_error(message, "WARNING")

## Log an exception-like error
func log_exception(message: String, exception_type: String = "Exception") -> void:
    log_error(message, exception_type, _get_stack_trace())

## Get current stack trace as string
func _get_stack_trace() -> String:
    var stack := get_stack()
    var trace := ""
    for frame in stack:
        trace += "  at %s:%d in %s()\n" % [frame.source, frame.line, frame.function]
    return trace

## Write error data to log file
func _write_to_log(data: Dictionary) -> void:
    var file := FileAccess.open(LOG_FILE_PATH, FileAccess.READ_WRITE)
    if not file:
        # Create new file
        file = FileAccess.open(LOG_FILE_PATH, FileAccess.WRITE)
    
    if file:
        file.seek_end()
        
        # Check log size and rotate if too large
        if file.get_length() > MAX_LOG_SIZE:
            file.close()
            _rotate_log()
            file = FileAccess.open(LOG_FILE_PATH, FileAccess.WRITE)
        
        var json := JSON.stringify(data)
        file.store_line(json)
        file.close()

func _rotate_log() -> void:
    var dir := DirAccess.open("user://crash_reports")
    if dir:
        # Rename current log to timestamped backup
        var timestamp := Time.get_datetime_string_from_system().replace(":", "-")
        var backup_name := "error_log_%s.txt" % timestamp
        dir.rename("error_log.txt", backup_name)
        
        # Clean up old logs (keep last 5)
        var logs: Array[String] = []
        dir.list_dir_begin()
        var file_name := dir.get_next()
        while file_name != "":
            if file_name.begins_with("error_log_") and file_name.ends_with(".txt"):
                logs.append(file_name)
            file_name = dir.get_next()
        dir.list_dir_end()
        
        logs.sort()
        while logs.size() > 5:
            dir.remove(logs.pop_front())

## Get error buffer for display or upload
func get_error_buffer() -> Array[Dictionary]:
    return _error_buffer.duplicate()

func get_error_count() -> int:
    return _error_buffer.size()

func clear_error_buffer() -> void:
    _error_buffer.clear()

## Get recent log entries
func get_recent_logs(count: int = 20) -> Array[String]:
    var logs: Array[String] = []
    var file := FileAccess.open(LOG_FILE_PATH, FileAccess.READ)
    if file:
        var all_lines: Array[String] = []
        while not file.eof_reached():
            var line := file.get_line()
            if line.strip_edges() != "":
                all_lines.append(line)
        file.close()
        
        # Return last N lines
        var start := maxi(0, all_lines.size() - count)
        for i in range(start, all_lines.size()):
            logs.append(all_lines[i])
    return logs

## Stub: Upload crash reports to backend
func upload_crash_report(error_id: int = -1) -> void:
    # Stub: would send error data to crash reporting backend
    print("[CrashReportManager] upload_crash_report(%d) called (stub - no action)" % error_id)
    crash_report_uploaded.emit(true)

func upload_all_reports() -> void:
    # Stub: would upload all buffered errors
    print("[CrashReportManager] upload_all_reports() called (stub - no action)")
    crash_report_uploaded.emit(true)

## Save/load support
func get_save_data() -> Dictionary:
    return {
        "error_count": _error_buffer.size(),
        "crash_report_id": _crash_report_id
    }

func load_save_data(data: Dictionary) -> void:
    _crash_report_id = data.get("crash_report_id", 0)
