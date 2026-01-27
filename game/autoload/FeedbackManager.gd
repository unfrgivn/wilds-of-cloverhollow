extends Node

## FeedbackManager - Handles in-app feedback collection and storage

signal feedback_submitted(feedback: Dictionary)
signal feedback_ui_opened
signal feedback_ui_closed

# Stored feedback (local, for future upload)
var _feedback_queue: Array[Dictionary] = []
var _feedback_ui: Control = null

const FEEDBACK_FILE := "user://feedback_queue.json"
const MAX_QUEUED_FEEDBACK := 50

func _ready() -> void:
    _load_feedback_queue()
    print("[FeedbackManager] Initialized with %d queued items" % _feedback_queue.size())

## Register the UI for showing feedback form
func register_ui(ui: Control) -> void:
    _feedback_ui = ui
    print("[FeedbackManager] UI registered")

## Open the feedback UI
func open_feedback() -> void:
    if _feedback_ui != null:
        _feedback_ui.show_feedback()
    feedback_ui_opened.emit()
    print("[FeedbackManager] Opening feedback UI")

## Close the feedback UI
func close_feedback() -> void:
    if _feedback_ui != null:
        _feedback_ui.hide_feedback()
    feedback_ui_closed.emit()
    print("[FeedbackManager] Closing feedback UI")

## Submit feedback
func submit_feedback(message: String, category: String = "general", email: String = "") -> void:
    if message.strip_edges().is_empty():
        print("[FeedbackManager] Empty feedback, ignoring")
        return
    
    var feedback := {
        "message": message,
        "category": category,
        "email": email,
        "timestamp": Time.get_unix_time_from_system(),
        "version": ProjectSettings.get_setting("application/config/version", "1.0.0"),
        "submitted": false
    }
    
    _feedback_queue.append(feedback)
    _trim_queue()
    _save_feedback_queue()
    
    feedback_submitted.emit(feedback)
    print("[FeedbackManager] Feedback submitted: %s..." % message.substr(0, 30))

## Get number of pending feedback items
func get_pending_count() -> int:
    return _feedback_queue.size()

## Get all feedback (for debug/testing)
func get_all_feedback() -> Array[Dictionary]:
    return _feedback_queue.duplicate()

## Clear all feedback (for debug/testing)
func clear_all_feedback() -> void:
    _feedback_queue.clear()
    _save_feedback_queue()
    print("[FeedbackManager] All feedback cleared")

## Upload feedback to backend (stub)
func upload_feedback() -> void:
    if _feedback_queue.is_empty():
        print("[FeedbackManager] No feedback to upload")
        return
    
    # Stub - in production, this would POST to a backend
    print("[FeedbackManager] Would upload %d feedback items (stub)" % _feedback_queue.size())
    
    # Mark all as submitted
    for feedback in _feedback_queue:
        feedback["submitted"] = true
    
    _save_feedback_queue()

## Trim queue if over limit
func _trim_queue() -> void:
    while _feedback_queue.size() > MAX_QUEUED_FEEDBACK:
        _feedback_queue.pop_front()

## Save feedback queue to disk
func _save_feedback_queue() -> void:
    var file := FileAccess.open(FEEDBACK_FILE, FileAccess.WRITE)
    if file == null:
        push_warning("[FeedbackManager] Failed to save feedback queue")
        return
    
    file.store_string(JSON.stringify(_feedback_queue, "\t"))
    file.close()

## Load feedback queue from disk
func _load_feedback_queue() -> void:
    if not FileAccess.file_exists(FEEDBACK_FILE):
        return
    
    var file := FileAccess.open(FEEDBACK_FILE, FileAccess.READ)
    if file == null:
        return
    
    var json := JSON.new()
    var content := file.get_as_text()
    file.close()
    
    if json.parse(content) != OK:
        push_warning("[FeedbackManager] Failed to parse feedback file")
        return
    
    var data = json.get_data()
    if data is Array:
        _feedback_queue.clear()
        for item in data:
            if item is Dictionary:
                _feedback_queue.append(item)
