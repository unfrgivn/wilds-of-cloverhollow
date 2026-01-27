extends Node

## PatchNotesManager - Tracks and displays "What's New" on version updates

signal patch_notes_shown(version: String)
signal patch_notes_dismissed(version: String)

var _current_version: String = "1.0.0"
var _last_seen_version: String = ""
var _patch_notes_ui: Control = null

const STATE_FILE := "user://patch_notes_state.json"

# Patch notes content (could also be loaded from JSON file)
var patch_notes: Dictionary = {
    "1.0.0": {
        "title": "Welcome to Cloverhollow!",
        "notes": [
            "Initial release",
            "Explore the cozy town of Cloverhollow",
            "Meet friendly NPCs and take on quests",
            "Battle cute creatures in turn-based combat"
        ]
    }
}

func _ready() -> void:
    _current_version = ProjectSettings.get_setting("application/config/version", "1.0.0")
    _load_state()
    print("[PatchNotesManager] Initialized - v%s (last seen: %s)" % [_current_version, _last_seen_version])

## Register the UI for showing patch notes
func register_ui(ui: Control) -> void:
    _patch_notes_ui = ui
    print("[PatchNotesManager] UI registered")

## Check if patch notes should be shown for this version
func should_show_patch_notes() -> bool:
    if _last_seen_version.is_empty():
        return true  # First launch
    return _current_version != _last_seen_version

## Get patch notes for current version
func get_current_patch_notes() -> Dictionary:
    if patch_notes.has(_current_version):
        return patch_notes[_current_version]
    
    # Return generic notes if not found
    return {
        "title": "What's New in v%s" % _current_version,
        "notes": ["Bug fixes and improvements"]
    }

## Mark current version as seen
func mark_as_seen() -> void:
    _last_seen_version = _current_version
    _save_state()
    print("[PatchNotesManager] Version %s marked as seen" % _current_version)

## Show the patch notes UI
func show_patch_notes() -> void:
    if _patch_notes_ui != null:
        _patch_notes_ui.show_notes(get_current_patch_notes())
    patch_notes_shown.emit(_current_version)
    print("[PatchNotesManager] Showing patch notes")

## Dismiss patch notes
func dismiss_patch_notes() -> void:
    mark_as_seen()
    if _patch_notes_ui != null:
        _patch_notes_ui.hide_notes()
    patch_notes_dismissed.emit(_current_version)
    print("[PatchNotesManager] Dismissed")

## Reset seen state (for testing)
func reset_seen_state() -> void:
    _last_seen_version = ""
    _save_state()
    print("[PatchNotesManager] State reset")

## Add patch notes for a version (for testing/dynamic updates)
func add_patch_notes(version: String, title: String, notes: Array) -> void:
    patch_notes[version] = {
        "title": title,
        "notes": notes
    }
    print("[PatchNotesManager] Added notes for v%s" % version)

## Save state to disk
func _save_state() -> void:
    var data := {
        "last_seen_version": _last_seen_version
    }
    
    var file := FileAccess.open(STATE_FILE, FileAccess.WRITE)
    if file != null:
        file.store_string(JSON.stringify(data, "\t"))
        file.close()

## Load state from disk
func _load_state() -> void:
    if not FileAccess.file_exists(STATE_FILE):
        return
    
    var file := FileAccess.open(STATE_FILE, FileAccess.READ)
    if file == null:
        return
    
    var json := JSON.new()
    if json.parse(file.get_as_text()) == OK:
        var data = json.get_data()
        if data is Dictionary:
            _last_seen_version = data.get("last_seen_version", "")
    
    file.close()
