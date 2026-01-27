extends CanvasLayer
# OutfitSelectionUI - Grid-based outfit selection interface

signal outfit_selected(outfit_id: String)
signal outfit_ui_closed

@onready var panel: Panel = $Panel
@onready var category_container: HBoxContainer = $Panel/VBoxContainer/CategoryContainer
@onready var outfit_grid: GridContainer = $Panel/VBoxContainer/OutfitGrid
@onready var preview_sprite: Sprite2D = $Panel/VBoxContainer/PreviewContainer/PreviewSprite
@onready var outfit_name_label: Label = $Panel/VBoxContainer/DetailsContainer/OutfitNameLabel
@onready var outfit_desc_label: Label = $Panel/VBoxContainer/DetailsContainer/OutfitDescLabel
@onready var equip_button: Button = $Panel/VBoxContainer/ButtonContainer/EquipButton
@onready var close_button: Button = $Panel/VBoxContainer/ButtonContainer/CloseButton

var _current_category: String = ""
var _selected_outfit_id: String = ""
var _is_visible: bool = false


func _ready() -> void:
    visible = false
    process_mode = Node.PROCESS_MODE_ALWAYS
    
    if equip_button:
        equip_button.pressed.connect(_on_equip_pressed)
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
    _setup_categories()
    _refresh_outfits()


func hide_ui() -> void:
    _is_visible = false
    visible = false
    get_tree().paused = false
    outfit_ui_closed.emit()


func _setup_categories() -> void:
    if not category_container:
        return
    
    # Clear existing category buttons
    for child in category_container.get_children():
        child.queue_free()
    
    # Add "All" category
    var all_button := Button.new()
    all_button.text = "All"
    all_button.pressed.connect(_on_category_selected.bind(""))
    category_container.add_child(all_button)
    
    # Add category buttons from CostumeManager
    var categories: Array = CostumeManager.get_categories()
    for category in categories:
        var button := Button.new()
        button.text = category.get("name", category.get("id", ""))
        button.pressed.connect(_on_category_selected.bind(category.get("id", "")))
        category_container.add_child(button)
    
    _current_category = ""


func _on_category_selected(category_id: String) -> void:
    _current_category = category_id
    _refresh_outfits()


func _refresh_outfits() -> void:
    if not outfit_grid:
        return
    
    # Clear existing outfit buttons
    for child in outfit_grid.get_children():
        child.queue_free()
    
    # Get outfits based on category filter
    var outfits: Array
    if _current_category.is_empty():
        outfits = CostumeManager.get_unlocked_outfits()
    else:
        var all_in_category := CostumeManager.get_outfits_by_category(_current_category)
        outfits = []
        for outfit in all_in_category:
            if CostumeManager.is_outfit_unlocked(outfit.id):
                outfits.append(outfit)
    
    # Create outfit buttons
    for outfit in outfits:
        var button := Button.new()
        button.text = outfit.get("name", outfit.get("id", ""))
        button.custom_minimum_size = Vector2(100, 40)
        
        # Highlight equipped outfit
        if outfit.id == CostumeManager.get_equipped_outfit():
            button.text = "✓ " + button.text
        
        button.pressed.connect(_on_outfit_selected.bind(outfit.id))
        outfit_grid.add_child(button)
    
    # Auto-select first outfit if available
    if outfits.size() > 0 and _selected_outfit_id.is_empty():
        _on_outfit_selected(outfits[0].id)


func _on_outfit_selected(outfit_id: String) -> void:
    _selected_outfit_id = outfit_id
    _update_details()


func _update_details() -> void:
    var outfit: Dictionary = CostumeManager.get_outfit(_selected_outfit_id)
    
    if outfit_name_label:
        outfit_name_label.text = outfit.get("name", "Unknown")
    
    if outfit_desc_label:
        outfit_desc_label.text = outfit.get("description", "")
    
    if equip_button:
        var is_equipped := _selected_outfit_id == CostumeManager.get_equipped_outfit()
        equip_button.text = "Equipped" if is_equipped else "Equip"
        equip_button.disabled = is_equipped
    
    # Preview sprite would be updated here when we have sprite assets
    # For now, just log the sprite path
    var sprite_path: String = outfit.get("sprite_path", "")
    if preview_sprite and not sprite_path.is_empty():
        # Future: Load preview texture
        pass


func _on_equip_pressed() -> void:
    if _selected_outfit_id.is_empty():
        return
    
    if CostumeManager.equip_outfit(_selected_outfit_id):
        outfit_selected.emit(_selected_outfit_id)
        _refresh_outfits()
        _update_details()


func _on_close_pressed() -> void:
    hide_ui()
