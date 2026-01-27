extends CanvasLayer
# PetAccessoryUI - Grid-based pet accessory selection interface

signal accessory_selected(slot: String, accessory_id: String)
signal accessory_ui_closed

@onready var panel: Panel = $Panel
@onready var slot_container: HBoxContainer = $Panel/VBoxContainer/SlotContainer
@onready var accessory_grid: GridContainer = $Panel/VBoxContainer/AccessoryGrid
@onready var accessory_name_label: Label = $Panel/VBoxContainer/DetailsContainer/AccessoryNameLabel
@onready var accessory_desc_label: Label = $Panel/VBoxContainer/DetailsContainer/AccessoryDescLabel
@onready var equip_button: Button = $Panel/VBoxContainer/ButtonContainer/EquipButton
@onready var unequip_button: Button = $Panel/VBoxContainer/ButtonContainer/UnequipButton
@onready var close_button: Button = $Panel/VBoxContainer/ButtonContainer/CloseButton

var _current_slot: String = "neck"
var _selected_accessory_id: String = ""
var _is_visible: bool = false


func _ready() -> void:
    visible = false
    process_mode = Node.PROCESS_MODE_ALWAYS
    
    if equip_button:
        equip_button.pressed.connect(_on_equip_pressed)
    if unequip_button:
        unequip_button.pressed.connect(_on_unequip_pressed)
    if close_button:
        close_button.pressed.connect(_on_close_pressed)


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    if event.is_action_pressed("cancel") or event.is_action_pressed("pause"):
        hide_ui()
        get_viewport().set_input_as_handled()


func show_ui() -> void:
    _is_visible = true
    visible = true
    get_tree().paused = true
    _setup_slots()
    _refresh_accessories()


func hide_ui() -> void:
    _is_visible = false
    visible = false
    get_tree().paused = false
    accessory_ui_closed.emit()


func _setup_slots() -> void:
    if not slot_container:
        return
    
    # Clear existing slot buttons
    for child in slot_container.get_children():
        child.queue_free()
    
    # Add slot buttons
    var slots: Array = PetAccessoryManager.get_slots()
    for slot in slots:
        var button := Button.new()
        button.text = slot.get("name", slot.get("id", ""))
        button.pressed.connect(_on_slot_selected.bind(slot.get("id", "")))
        slot_container.add_child(button)
    
    # Default to first slot
    if slots.size() > 0:
        _current_slot = slots[0].get("id", "neck")


func _on_slot_selected(slot_id: String) -> void:
    _current_slot = slot_id
    _selected_accessory_id = ""
    _refresh_accessories()


func _refresh_accessories() -> void:
    if not accessory_grid:
        return
    
    # Clear existing accessory buttons
    for child in accessory_grid.get_children():
        child.queue_free()
    
    # Get unlocked accessories for current slot
    var all_for_slot := PetAccessoryManager.get_accessories_by_slot(_current_slot)
    var accessories := []
    for accessory in all_for_slot:
        if PetAccessoryManager.is_accessory_unlocked(accessory.id):
            accessories.append(accessory)
    
    # Get currently equipped for this slot
    var equipped_id := PetAccessoryManager.get_equipped_accessory(_current_slot)
    
    # Create accessory buttons
    for accessory in accessories:
        var button := Button.new()
        button.text = accessory.get("name", accessory.get("id", ""))
        button.custom_minimum_size = Vector2(100, 40)
        
        # Highlight equipped accessory
        if accessory.id == equipped_id:
            button.text = "✓ " + button.text
        
        button.pressed.connect(_on_accessory_selected.bind(accessory.id))
        accessory_grid.add_child(button)
    
    _update_details()


func _on_accessory_selected(accessory_id: String) -> void:
    _selected_accessory_id = accessory_id
    _update_details()


func _update_details() -> void:
    var equipped_id := PetAccessoryManager.get_equipped_accessory(_current_slot)
    
    if _selected_accessory_id.is_empty():
        if accessory_name_label:
            accessory_name_label.text = "Select an accessory"
        if accessory_desc_label:
            accessory_desc_label.text = ""
        if equip_button:
            equip_button.disabled = true
        if unequip_button:
            unequip_button.disabled = equipped_id.is_empty()
        return
    
    var accessory: Dictionary = PetAccessoryManager.get_accessory(_selected_accessory_id)
    
    if accessory_name_label:
        accessory_name_label.text = accessory.get("name", "Unknown")
    
    if accessory_desc_label:
        accessory_desc_label.text = accessory.get("description", "")
    
    if equip_button:
        var is_equipped := _selected_accessory_id == equipped_id
        equip_button.text = "Equipped" if is_equipped else "Equip"
        equip_button.disabled = is_equipped
    
    if unequip_button:
        unequip_button.disabled = equipped_id.is_empty()


func _on_equip_pressed() -> void:
    if _selected_accessory_id.is_empty():
        return
    
    if PetAccessoryManager.equip_accessory(_selected_accessory_id):
        accessory_selected.emit(_current_slot, _selected_accessory_id)
        _refresh_accessories()


func _on_unequip_pressed() -> void:
    PetAccessoryManager.unequip_slot(_current_slot)
    _refresh_accessories()


func _on_close_pressed() -> void:
    hide_ui()
