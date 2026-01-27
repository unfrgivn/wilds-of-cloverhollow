extends CanvasLayer
## BugCollectionLog - Displays caught bugs and collection progress

@onready var title_label: Label = $Panel/TitleLabel
@onready var bug_list: VBoxContainer = $Panel/ScrollContainer/BugList
@onready var progress_label: Label = $Panel/ProgressLabel
@onready var close_button: Button = $Panel/CloseButton

var _bug_data: Dictionary = {}
var _caught_bugs: Dictionary = {}  # {bug_id: count}

func _ready() -> void:
    visible = false
    close_button.pressed.connect(_on_close)
    _load_bug_data()

func _load_bug_data() -> void:
    var file := FileAccess.open("res://game/data/bugs/bugs.json", FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            _bug_data = json.data
    else:
        push_warning("[BugCollectionLog] Could not load bug data")

func show_log() -> void:
    visible = true
    _update_caught_bugs()
    _refresh_display()

func _update_caught_bugs() -> void:
    _caught_bugs.clear()
    var all_bugs: Array = _bug_data.get("bugs", [])
    for bug in all_bugs:
        var bug_id: String = bug.get("id", "")
        if InventoryManager.has_item(bug_id, 1):
            _caught_bugs[bug_id] = InventoryManager.get_item_count(bug_id)

func _refresh_display() -> void:
    # Clear existing entries
    for child in bug_list.get_children():
        child.queue_free()
    
    var all_bugs: Array = _bug_data.get("bugs", [])
    var total_bugs: int = all_bugs.size()
    var caught_count: int = _caught_bugs.size()
    
    # Update progress
    progress_label.text = "Collection: %d / %d (%.0f%%)" % [
        caught_count,
        total_bugs,
        (float(caught_count) / float(total_bugs)) * 100.0 if total_bugs > 0 else 0.0
    ]
    
    # Create entry for each bug
    for bug in all_bugs:
        var bug_id: String = bug.get("id", "")
        var bug_name: String = bug.get("name", "???")
        var is_caught: bool = _caught_bugs.has(bug_id)
        
        var entry := HBoxContainer.new()
        entry.custom_minimum_size.y = 24
        
        var icon := ColorRect.new()
        icon.custom_minimum_size = Vector2(16, 16)
        icon.color = Color(0.2, 0.6, 0.2) if is_caught else Color(0.3, 0.3, 0.3)
        entry.add_child(icon)
        
        var name_label := Label.new()
        if is_caught:
            name_label.text = " %s x%d" % [bug_name, _caught_bugs[bug_id]]
        else:
            name_label.text = " ???"
        entry.add_child(name_label)
        
        bug_list.add_child(entry)

func _on_close() -> void:
    visible = false

func _input(event: InputEvent) -> void:
    if not visible:
        return
    
    if event.is_action_pressed("ui_cancel"):
        _on_close()
        get_viewport().set_input_as_handled()
