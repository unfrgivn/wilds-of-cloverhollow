extends Node
## AccessibilityManager autoload
##
## Handles screen reader support, accessibility labels, and focus management.
## Provides a centralized system for making UI elements accessible.

signal screen_reader_enabled_changed(enabled: bool)
signal focus_changed(element_name: String, element_description: String)
signal element_announced(text: String)

## Whether screen reader mode is enabled
var screen_reader_enabled: bool = false:
    set(value):
        screen_reader_enabled = value
        screen_reader_enabled_changed.emit(value)
        _save_settings()

## Current focused element name (for debugging/testing)
var _current_focus_name: String = ""
var _current_focus_description: String = ""

## Announcement queue for screen reader
var _announcement_queue: Array[String] = []

## Settings file path
const SETTINGS_PATH := "user://accessibility_settings.json"


func _ready() -> void:
    _load_settings()


func _load_settings() -> void:
    if not FileAccess.file_exists(SETTINGS_PATH):
        return
    var file := FileAccess.open(SETTINGS_PATH, FileAccess.READ)
    if file == null:
        return
    var json := JSON.new()
    var err := json.parse(file.get_as_text())
    file.close()
    if err != OK:
        return
    var data: Dictionary = json.data
    if data.has("screen_reader_enabled"):
        screen_reader_enabled = data["screen_reader_enabled"]


func _save_settings() -> void:
    var data := {
        "screen_reader_enabled": screen_reader_enabled
    }
    var file := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
    if file == null:
        push_warning("[AccessibilityManager] Failed to save settings")
        return
    file.store_string(JSON.stringify(data, "\t"))
    file.close()


## Announce text to the screen reader
## This queues the announcement for the next available slot
func announce(text: String) -> void:
    if not screen_reader_enabled:
        return
    _announcement_queue.append(text)
    element_announced.emit(text)
    # In a real implementation, this would interface with the OS screen reader
    # For now, we just emit the signal for testing
    print("[Accessibility] Announce: %s" % text)


## Register a focus change on a UI element
## [param element_name]: Short name of the focused element (e.g., "Attack Button")
## [param element_description]: Full description for screen reader (e.g., "Attack the selected enemy")
func register_focus(element_name: String, element_description: String = "") -> void:
    _current_focus_name = element_name
    _current_focus_description = element_description
    focus_changed.emit(element_name, element_description)
    if screen_reader_enabled:
        var full_text := element_name
        if element_description != "":
            full_text += ". " + element_description
        announce(full_text)


## Clear the current focus
func clear_focus() -> void:
    _current_focus_name = ""
    _current_focus_description = ""


## Get the current focused element name
func get_current_focus_name() -> String:
    return _current_focus_name


## Get the current focused element description
func get_current_focus_description() -> String:
    return _current_focus_description


## Check if an element is currently focused
func is_element_focused(element_name: String) -> bool:
    return _current_focus_name == element_name


## Get recent announcements (for testing)
func get_recent_announcements(count: int = 5) -> Array[String]:
    var start := maxi(0, _announcement_queue.size() - count)
    var result: Array[String] = []
    for i in range(start, _announcement_queue.size()):
        result.append(_announcement_queue[i])
    return result


## Clear announcement history (for testing)
func clear_announcements() -> void:
    _announcement_queue.clear()


## Toggle screen reader mode
func toggle_screen_reader() -> void:
    screen_reader_enabled = not screen_reader_enabled
    if screen_reader_enabled:
        announce("Screen reader enabled")
    else:
        print("[Accessibility] Screen reader disabled")


## Apply accessibility labels to a Control node
## This is a helper function to make any control accessible
## [param control]: The control to make accessible
## [param name]: The accessible name
## [param description]: Optional description
func make_accessible(control: Control, accessible_name: String, description: String = "") -> void:
    if control == null:
        return
    # Connect focus signals if not already connected
    if not control.focus_entered.is_connected(_on_control_focus_entered.bind(control, accessible_name, description)):
        control.focus_entered.connect(_on_control_focus_entered.bind(control, accessible_name, description))
    if not control.focus_exited.is_connected(_on_control_focus_exited):
        control.focus_exited.connect(_on_control_focus_exited)
    # Ensure the control can receive focus
    if control.focus_mode == Control.FOCUS_NONE:
        control.focus_mode = Control.FOCUS_ALL


func _on_control_focus_entered(control: Control, accessible_name: String, description: String) -> void:
    register_focus(accessible_name, description)


func _on_control_focus_exited() -> void:
    clear_focus()


## Batch apply accessibility to multiple buttons
## [param buttons]: Array of [Button, name, description] arrays
func make_buttons_accessible(buttons: Array) -> void:
    for entry in buttons:
        if entry.size() >= 2:
            var btn: Control = entry[0]
            var btn_name: String = entry[1]
            var btn_desc: String = entry[2] if entry.size() > 2 else ""
            make_accessible(btn, btn_name, btn_desc)


## Reset all accessibility state (for testing)
func reset() -> void:
    clear_focus()
    clear_announcements()
