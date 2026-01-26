extends Node
## Global cutscene manager - handles playing scripted story sequences
## Supports text, camera shake, flash effects, and skip functionality

signal cutscene_started(cutscene_id: String)
signal cutscene_step_completed(step_index: int)
signal cutscene_finished(cutscene_id: String)
signal cutscene_skipped(cutscene_id: String)

enum StepType {
    TEXT,
    WAIT,
    SHAKE,
    FLASH
}

var _cutscene_ui: Node = null
var _is_playing: bool = false
var _can_skip: bool = true
var _current_cutscene_id: String = ""
var _current_cutscene: Dictionary = {}
var _current_step_index: int = 0
var _cutscene_data: Dictionary = {}
var _step_timer: Timer = null
var _skip_requested: bool = false


func _ready() -> void:
    _load_cutscene_data()
    _step_timer = Timer.new()
    _step_timer.one_shot = true
    _step_timer.timeout.connect(_on_step_timer_timeout)
    add_child(_step_timer)


func _load_cutscene_data() -> void:
    var file_path := "res://game/data/cutscenes/cutscenes.json"
    if not FileAccess.file_exists(file_path):
        push_warning("CutsceneManager: Cutscene data file not found: " + file_path)
        return
    
    var file := FileAccess.open(file_path, FileAccess.READ)
    if file == null:
        push_warning("CutsceneManager: Could not open cutscene data file")
        return
    
    var json_text := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var parse_result := json.parse(json_text)
    if parse_result != OK:
        push_warning("CutsceneManager: Failed to parse cutscene data JSON")
        return
    
    var data = json.data
    if data is Dictionary and data.has("cutscenes"):
        _cutscene_data = data["cutscenes"]


## Register the cutscene UI instance (called by CutsceneUI on _ready)
func register_ui(ui: Node) -> void:
    _cutscene_ui = ui


## Get a cutscene by ID
func get_cutscene(cutscene_id: String) -> Dictionary:
    if _cutscene_data.has(cutscene_id):
        return _cutscene_data[cutscene_id]
    return {}


## Get all cutscene IDs
func get_all_cutscene_ids() -> Array:
    return _cutscene_data.keys()


## Play a cutscene by ID
func play_cutscene(cutscene_id: String, can_skip: bool = true) -> bool:
    if _is_playing:
        push_warning("CutsceneManager: Already playing a cutscene")
        return false
    
    var cutscene := get_cutscene(cutscene_id)
    if cutscene.is_empty():
        push_warning("CutsceneManager: Cutscene not found: " + cutscene_id)
        return false
    
    _current_cutscene_id = cutscene_id
    _current_cutscene = cutscene
    _current_step_index = 0
    _is_playing = true
    _can_skip = can_skip
    _skip_requested = false
    
    # Pause the game tree during cutscene
    get_tree().paused = true
    
    if _cutscene_ui != null:
        _cutscene_ui.show_cutscene(cutscene, can_skip)
    
    cutscene_started.emit(cutscene_id)
    _play_current_step()
    return true


## Skip the current cutscene
func skip_cutscene() -> void:
    if not _is_playing or not _can_skip:
        return
    
    _skip_requested = true
    _step_timer.stop()
    _finish_cutscene(true)


## Advance to the next step (called by UI or timer)
func advance_step() -> void:
    if not _is_playing:
        return
    
    if _skip_requested:
        return
    
    cutscene_step_completed.emit(_current_step_index)
    _current_step_index += 1
    
    var steps: Array = _current_cutscene.get("steps", [])
    if _current_step_index >= steps.size():
        _finish_cutscene(false)
    else:
        _play_current_step()


## Check if a cutscene is currently playing
func is_playing() -> bool:
    return _is_playing


## Get the current cutscene ID
func get_current_cutscene_id() -> String:
    return _current_cutscene_id


## Check if skip is allowed for current cutscene
func can_skip_current() -> bool:
    return _can_skip


func _play_current_step() -> void:
    var steps: Array = _current_cutscene.get("steps", [])
    if _current_step_index >= steps.size():
        _finish_cutscene(false)
        return
    
    var step: Dictionary = steps[_current_step_index]
    var step_type := step.get("type", "text") as String
    var duration := step.get("duration", 2.0) as float
    
    match step_type:
        "text":
            if _cutscene_ui != null:
                var speaker := step.get("speaker", "") as String
                var text := step.get("text", "") as String
                _cutscene_ui.show_step_text(speaker, text)
            _step_timer.start(duration)
        "wait":
            _step_timer.start(duration)
        "shake":
            if _cutscene_ui != null:
                var intensity := step.get("intensity", 5) as int
                _cutscene_ui.play_shake(intensity, duration)
            _step_timer.start(duration)
        "flash":
            if _cutscene_ui != null:
                var color := step.get("color", "#FFFFFF") as String
                _cutscene_ui.play_flash(color, duration)
            _step_timer.start(duration)
        _:
            # Unknown step type - skip after duration
            _step_timer.start(duration)


func _on_step_timer_timeout() -> void:
    advance_step()


func _finish_cutscene(was_skipped: bool) -> void:
    var cutscene_id := _current_cutscene_id
    
    _is_playing = false
    _current_cutscene_id = ""
    _current_cutscene = {}
    _current_step_index = 0
    _skip_requested = false
    
    # Resume the game tree
    get_tree().paused = false
    
    if _cutscene_ui != null:
        _cutscene_ui.hide_cutscene()
    
    if was_skipped:
        cutscene_skipped.emit(cutscene_id)
    else:
        cutscene_finished.emit(cutscene_id)
