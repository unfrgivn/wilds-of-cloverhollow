extends CanvasLayer
## AffinityUI - Shows relationship status with NPCs
## Can be opened from pause menu or via keybind

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var npc_list: VBoxContainer = $Panel/NPCList
@onready var close_button: Button = $Panel/CloseButton

var _is_showing: bool = false

func _ready() -> void:
    visible = false
    if close_button:
        close_button.pressed.connect(_on_close_pressed)

func _input(event: InputEvent) -> void:
    if not _is_showing:
        return
    
    if event.is_action_pressed("ui_cancel"):
        hide_ui()
        get_viewport().set_input_as_handled()

func show_ui() -> void:
    _is_showing = true
    _populate_npc_list()
    visible = true

func hide_ui() -> void:
    _is_showing = false
    visible = false

func _populate_npc_list() -> void:
    # Clear existing entries
    for child in npc_list.get_children():
        child.queue_free()
    
    # Get all NPCs with affinity
    var all_affinity = AffinityManager.get_all_affinity()
    var sorted_npcs = AffinityManager.get_sorted_npcs()
    
    if sorted_npcs.is_empty():
        var label = Label.new()
        label.text = "No relationships yet..."
        npc_list.add_child(label)
        return
    
    for npc_data in sorted_npcs:
        var npc_id: String = npc_data["id"]
        var affinity: int = npc_data["affinity"]
        var npc_name = AffinityManager.get_npc_name(npc_id)
        var level = AffinityManager.get_npc_level(npc_id)
        
        var entry = _create_npc_entry(npc_id, npc_name, affinity, level)
        npc_list.add_child(entry)

func _create_npc_entry(npc_id: String, npc_name: String, affinity: int, level: String) -> HBoxContainer:
    var container = HBoxContainer.new()
    container.custom_minimum_size = Vector2(400, 30)
    
    # NPC name
    var name_label = Label.new()
    name_label.text = npc_name
    name_label.custom_minimum_size = Vector2(120, 0)
    container.add_child(name_label)
    
    # Level text
    var level_label = Label.new()
    level_label.text = level
    level_label.custom_minimum_size = Vector2(100, 0)
    level_label.add_theme_color_override("font_color", _get_level_color(level))
    container.add_child(level_label)
    
    # Affinity bar
    var progress = ProgressBar.new()
    progress.min_value = 0
    progress.max_value = 100
    progress.value = affinity
    progress.custom_minimum_size = Vector2(150, 20)
    progress.show_percentage = false
    container.add_child(progress)
    
    # Affinity value
    var value_label = Label.new()
    value_label.text = str(affinity) + "/100"
    value_label.custom_minimum_size = Vector2(50, 0)
    container.add_child(value_label)
    
    return container

func _get_level_color(level: String) -> Color:
    match level:
        "Stranger":
            return Color.GRAY
        "Acquaintance":
            return Color.WHITE
        "Friend":
            return Color.LIGHT_GREEN
        "Good Friend":
            return Color.GREEN
        "Best Friend":
            return Color.GOLD
        "Soulmate":
            return Color.MAGENTA
        _:
            return Color.WHITE

func _on_close_pressed() -> void:
    hide_ui()
