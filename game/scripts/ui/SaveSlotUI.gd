extends CanvasLayer

## SaveSlotUI - Displays save slots for saving/loading

signal slot_selected(slot: int, action: String)  # action: "save", "load", "delete"
signal closed

enum Mode { SAVE, LOAD }

@onready var panel: PanelContainer = $Panel
@onready var title_label: Label = $Panel/VBox/TitleLabel
@onready var slots_container: VBoxContainer = $Panel/VBox/SlotsContainer
@onready var help_label: Label = $Panel/VBox/HelpLabel

var _mode: Mode = Mode.SAVE
var _selected_index: int = 0
var _slot_buttons: Array[Button] = []
var _is_visible: bool = false


func _ready() -> void:
    panel.visible = false
    _refresh_slots()


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    if event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
        close()
        get_viewport().set_input_as_handled()
        return
    
    if event.is_action_pressed("ui_up"):
        _select_slot((_selected_index - 1 + _slot_buttons.size()) % _slot_buttons.size())
        get_viewport().set_input_as_handled()
    elif event.is_action_pressed("ui_down"):
        _select_slot((_selected_index + 1) % _slot_buttons.size())
        get_viewport().set_input_as_handled()
    elif event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
        _confirm_selection()
        get_viewport().set_input_as_handled()
    elif event.is_action_pressed("ui_focus_next"):  # Tab or alternate key for delete
        _delete_slot(_selected_index)
        get_viewport().set_input_as_handled()


func open_for_save() -> void:
    _mode = Mode.SAVE
    title_label.text = "Save Game"
    help_label.text = "Select slot to save | Cancel: Back | Tab: Delete"
    _refresh_slots()
    _show()


func open_for_load() -> void:
    _mode = Mode.LOAD
    title_label.text = "Load Game"
    help_label.text = "Select slot to load | Cancel: Back | Tab: Delete"
    _refresh_slots()
    _show()


func _show() -> void:
    panel.visible = true
    _is_visible = true
    _select_slot(0)


func close() -> void:
    panel.visible = false
    _is_visible = false
    closed.emit()


func _refresh_slots() -> void:
    # Clear existing buttons
    for child in slots_container.get_children():
        child.queue_free()
    _slot_buttons.clear()
    
    # Get slot previews
    var previews := SaveManager.get_all_slot_previews()
    
    for i in range(SaveManager.MAX_SLOTS):
        var preview: Dictionary = previews[i]
        var btn := Button.new()
        btn.custom_minimum_size = Vector2(280, 40)
        btn.alignment = HORIZONTAL_ALIGNMENT_LEFT
        
        if preview.get("empty", true):
            btn.text = "Slot %d: Empty" % (i + 1)
            btn.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
        else:
            var area_name: String = preview.get("area_name", "Unknown")
            var time_str: String = preview.get("timestamp_formatted", "")
            btn.text = "Slot %d: %s - %s" % [i + 1, area_name, time_str]
        
        slots_container.add_child(btn)
        _slot_buttons.append(btn)
        
        # Connect button press
        var slot_idx := i
        btn.pressed.connect(func() -> void: _on_slot_pressed(slot_idx))


func _select_slot(index: int) -> void:
    # Deselect old
    if _selected_index < _slot_buttons.size():
        var old_btn := _slot_buttons[_selected_index]
        old_btn.add_theme_stylebox_override("normal", null)
    
    _selected_index = index
    
    # Select new
    if _selected_index < _slot_buttons.size():
        var btn := _slot_buttons[_selected_index]
        # Highlight selected button
        btn.grab_focus()


func _on_slot_pressed(slot: int) -> void:
    _selected_index = slot
    _confirm_selection()


func _confirm_selection() -> void:
    var slot := _selected_index
    var preview := SaveManager.get_slot_preview(slot)
    
    if _mode == Mode.SAVE:
        # Save to slot
        var success := SaveManager.save_game(slot)
        if success:
            print("[SaveSlotUI] Saved to slot %d" % slot)
            _refresh_slots()
            slot_selected.emit(slot, "save")
    else:  # LOAD
        if preview.get("empty", true):
            print("[SaveSlotUI] Cannot load empty slot %d" % slot)
            return
        # Load from slot
        close()
        slot_selected.emit(slot, "load")
        SaveManager.load_game(slot)


func _delete_slot(slot: int) -> void:
    var preview := SaveManager.get_slot_preview(slot)
    if preview.get("empty", true):
        return
    
    # For now, delete directly (could add confirmation dialog later)
    var success := SaveManager.delete_save(slot)
    if success:
        print("[SaveSlotUI] Deleted slot %d" % slot)
        _refresh_slots()
        slot_selected.emit(slot, "delete")
