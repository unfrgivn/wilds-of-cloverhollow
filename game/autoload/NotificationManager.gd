extends Node

## NotificationManager - Handles toast/popup notifications

signal notification_shown(notification: Dictionary)
signal notification_hidden()

# Notification types
enum NotificationType {
    INFO,
    QUEST,
    ITEM,
    LEVEL_UP,
    ACHIEVEMENT
}

# Notification queue
var _queue: Array[Dictionary] = []
var _is_showing: bool = false
var _current_notification: Dictionary = {}

# Display settings
const DEFAULT_DURATION: float = 3.0
const ITEM_DURATION: float = 2.0
const QUEST_DURATION: float = 4.0

# Reference to the UI
var _notification_ui: Control = null

func _ready() -> void:
    print("[NotificationManager] Initialized")

## Register the UI for displaying notifications
func register_ui(ui: Control) -> void:
    _notification_ui = ui
    print("[NotificationManager] UI registered")

## Show a generic notification
func show_notification(title: String, message: String = "", type: NotificationType = NotificationType.INFO, icon: Texture2D = null, duration: float = DEFAULT_DURATION) -> void:
    var notification := {
        "title": title,
        "message": message,
        "type": type,
        "icon": icon,
        "duration": duration
    }
    _queue_notification(notification)

## Show quest received notification
func show_quest_received(quest_name: String) -> void:
    show_notification("Quest Started!", quest_name, NotificationType.QUEST, null, QUEST_DURATION)
    print("[NotificationManager] Quest received: ", quest_name)

## Show quest completed notification
func show_quest_completed(quest_name: String) -> void:
    show_notification("Quest Complete!", quest_name, NotificationType.QUEST, null, QUEST_DURATION)
    print("[NotificationManager] Quest completed: ", quest_name)

## Show item obtained notification
func show_item_obtained(item_name: String, count: int = 1) -> void:
    var message := item_name if count == 1 else "%s x%d" % [item_name, count]
    show_notification("Item Obtained", message, NotificationType.ITEM, null, ITEM_DURATION)
    print("[NotificationManager] Item obtained: ", message)

## Show tool acquired notification
func show_tool_acquired(tool_name: String) -> void:
    show_notification("Tool Acquired!", tool_name, NotificationType.ITEM, null, QUEST_DURATION)
    print("[NotificationManager] Tool acquired: ", tool_name)

## Show level up notification
func show_level_up(character_name: String, new_level: int) -> void:
    show_notification("Level Up!", "%s is now Lv. %d" % [character_name, new_level], NotificationType.LEVEL_UP, null, QUEST_DURATION)
    print("[NotificationManager] Level up: %s -> Lv.%d" % [character_name, new_level])

## Show achievement notification
func show_achievement(achievement_name: String) -> void:
    show_notification("Achievement Unlocked!", achievement_name, NotificationType.ACHIEVEMENT, null, QUEST_DURATION)
    print("[NotificationManager] Achievement: ", achievement_name)

## Add notification to queue
func _queue_notification(notification: Dictionary) -> void:
    _queue.append(notification)
    _process_queue()

## Process notification queue
func _process_queue() -> void:
    if _is_showing or _queue.is_empty():
        return
    
    _current_notification = _queue.pop_front()
    _is_showing = true
    notification_shown.emit(_current_notification)
    
    # Display in UI if available
    if _notification_ui != null and _notification_ui.has_method("show_notification"):
        _notification_ui.show_notification(_current_notification)
    
    # Auto-hide after duration
    var timer := get_tree().create_timer(_current_notification.get("duration", DEFAULT_DURATION))
    timer.timeout.connect(_on_notification_timeout)

func _on_notification_timeout() -> void:
    _hide_current()
    _process_queue()

func _hide_current() -> void:
    _is_showing = false
    _current_notification = {}
    
    if _notification_ui != null and _notification_ui.has_method("hide_notification"):
        _notification_ui.hide_notification()
    
    notification_hidden.emit()

## Check if showing a notification
func is_showing() -> bool:
    return _is_showing

## Get current notification (for testing)
func get_current_notification() -> Dictionary:
    return _current_notification

## Get queue size (for testing)
func get_queue_size() -> int:
    return _queue.size()

## Clear all notifications
func clear_all() -> void:
    _queue.clear()
    if _is_showing:
        _hide_current()
    print("[NotificationManager] Cleared all notifications")
