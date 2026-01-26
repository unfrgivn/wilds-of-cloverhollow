extends Node

## TutorialHintsManager - Handles contextual tutorial hints for first-time mechanics

signal hint_shown(hint_id: String)
signal hint_dismissed(hint_id: String)

# Hint definitions: id -> {title, message, trigger}
const HINT_DATA := {
    "movement": {
        "title": "Movement",
        "message": "Use the joystick or arrow keys to move around!",
        "priority": 1
    },
    "interact": {
        "title": "Interaction",
        "message": "Press the action button near objects to interact!",
        "priority": 2
    },
    "dialogue": {
        "title": "Dialogue",
        "message": "Press action to advance dialogue. Some choices matter!",
        "priority": 3
    },
    "battle_start": {
        "title": "Battle!",
        "message": "You've encountered an enemy! Choose actions wisely.",
        "priority": 4
    },
    "battle_attack": {
        "title": "Attack",
        "message": "Attack deals damage based on your ATK vs enemy DEF.",
        "priority": 5
    },
    "battle_defend": {
        "title": "Defend",
        "message": "Defend reduces damage taken until your next turn.",
        "priority": 6
    },
    "quest_board": {
        "title": "Quest Board",
        "message": "Check the bulletin board for available quests!",
        "priority": 7
    },
    "inventory": {
        "title": "Inventory",
        "message": "Open the pause menu to view items and equipment.",
        "priority": 8
    },
    "save_game": {
        "title": "Saving",
        "message": "Save your game from the pause menu.",
        "priority": 9
    },
}

# Set of dismissed hint IDs (persisted)
var _dismissed_hints: Dictionary = {}

# Whether hints are enabled globally
var hints_enabled: bool = true

# Reference to the hint UI (spawned lazily)
var _hint_ui: CanvasLayer = null

# Currently showing hint
var _current_hint: String = ""

# Queue of pending hints
var _hint_queue: Array[String] = []


func _ready() -> void:
    _load_dismissed_hints()


## Show a hint if it hasn't been dismissed
func show_hint(hint_id: String) -> void:
    if not hints_enabled:
        print("[TutorialHints] Hints disabled, skipping: %s" % hint_id)
        return
    
    if not HINT_DATA.has(hint_id):
        push_error("[TutorialHints] Unknown hint ID: %s" % hint_id)
        return
    
    if _is_hint_dismissed(hint_id):
        print("[TutorialHints] Hint already dismissed: %s" % hint_id)
        return
    
    # Queue hint if one is showing
    if _current_hint != "":
        if not _hint_queue.has(hint_id):
            _hint_queue.append(hint_id)
            print("[TutorialHints] Queued hint: %s" % hint_id)
        return
    
    _display_hint(hint_id)


func _display_hint(hint_id: String) -> void:
    _ensure_hint_ui()
    
    var hint_info: Dictionary = HINT_DATA[hint_id]
    _current_hint = hint_id
    
    if _hint_ui and _hint_ui.has_method("show_hint"):
        _hint_ui.show_hint(hint_info.get("title", "Hint"), hint_info.get("message", ""))
    
    print("[TutorialHints] Showing hint: %s - %s" % [hint_id, hint_info.get("title", "")])
    hint_shown.emit(hint_id)


## Dismiss the current hint
func dismiss_current_hint() -> void:
    if _current_hint == "":
        return
    
    var dismissed_id := _current_hint
    _dismissed_hints[dismissed_id] = true
    _current_hint = ""
    
    if _hint_ui and _hint_ui.has_method("hide_hint"):
        _hint_ui.hide_hint()
    
    _save_dismissed_hints()
    
    print("[TutorialHints] Dismissed hint: %s" % dismissed_id)
    hint_dismissed.emit(dismissed_id)
    
    # Show next queued hint
    _process_queue()


func _process_queue() -> void:
    if _hint_queue.is_empty():
        return
    
    var next_hint: String = _hint_queue.pop_front()
    # Check again in case it was dismissed while queued
    if not _is_hint_dismissed(next_hint):
        # Small delay before showing next hint
        await get_tree().create_timer(0.3).timeout
        if _current_hint == "":  # Still no hint showing
            _display_hint(next_hint)


## Check if a hint has been dismissed
func _is_hint_dismissed(hint_id: String) -> bool:
    return _dismissed_hints.has(hint_id) and _dismissed_hints[hint_id] == true


## Check if a hint has been seen (dismissed)
func has_seen_hint(hint_id: String) -> bool:
    return _is_hint_dismissed(hint_id)


## Reset a specific hint (allow it to show again)
func reset_hint(hint_id: String) -> void:
    if _dismissed_hints.has(hint_id):
        _dismissed_hints.erase(hint_id)
        _save_dismissed_hints()
        print("[TutorialHints] Reset hint: %s" % hint_id)


## Reset all hints
func reset_all_hints() -> void:
    _dismissed_hints.clear()
    _save_dismissed_hints()
    print("[TutorialHints] Reset all hints")


## Enable/disable hints globally
func set_hints_enabled(enabled: bool) -> void:
    hints_enabled = enabled
    print("[TutorialHints] Hints enabled: %s" % enabled)


## Get current hint being shown
func get_current_hint() -> String:
    return _current_hint


## Get list of dismissed hints
func get_dismissed_hints() -> Array:
    return _dismissed_hints.keys()


## Force dismiss a hint by ID (for scenario testing)
func force_dismiss_hint(hint_id: String) -> void:
    if HINT_DATA.has(hint_id):
        _dismissed_hints[hint_id] = true
        _save_dismissed_hints()
        print("[TutorialHints] Force dismissed: %s" % hint_id)


func _ensure_hint_ui() -> void:
    if _hint_ui != null:
        return
    
    # Load and instance hint UI
    var scene: PackedScene = load("res://game/scenes/ui/TutorialHintUI.tscn")
    if scene:
        _hint_ui = scene.instantiate()
        get_tree().root.add_child(_hint_ui)
        _hint_ui.connect("hint_dismissed", _on_hint_ui_dismissed)
        print("[TutorialHints] Hint UI spawned")
    else:
        push_error("[TutorialHints] Failed to load TutorialHintUI.tscn")


func _on_hint_ui_dismissed() -> void:
    dismiss_current_hint()


## Persistence - save dismissed hints to settings
func _save_dismissed_hints() -> void:
    # Store with SettingsManager or directly to user://
    var file := FileAccess.open("user://tutorial_hints.json", FileAccess.WRITE)
    if file:
        var data := {
            "version": 1,
            "dismissed": _dismissed_hints.keys()
        }
        file.store_string(JSON.stringify(data))
        file.close()


func _load_dismissed_hints() -> void:
    if not FileAccess.file_exists("user://tutorial_hints.json"):
        return
    
    var file := FileAccess.open("user://tutorial_hints.json", FileAccess.READ)
    if not file:
        return
    
    var content := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var error := json.parse(content)
    if error != OK:
        return
    
    var data: Dictionary = json.data
    var dismissed_list: Array = data.get("dismissed", [])
    for hint_id: String in dismissed_list:
        _dismissed_hints[hint_id] = true
    
    print("[TutorialHints] Loaded %d dismissed hints" % _dismissed_hints.size())


## Save/Load for game save integration
func get_save_data() -> Dictionary:
    return {
        "dismissed_hints": _dismissed_hints.keys()
    }


func load_save_data(data: Dictionary) -> void:
    _dismissed_hints.clear()
    var dismissed_list: Array = data.get("dismissed_hints", [])
    for hint_id: String in dismissed_list:
        _dismissed_hints[hint_id] = true
    print("[TutorialHints] Loaded save data: %d dismissed hints" % _dismissed_hints.size())
