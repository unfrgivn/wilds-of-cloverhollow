extends CanvasLayer
## PhotoStickerUI - Sticker decoration overlay for photos
## Allows placing, moving, and scaling stickers before saving decorated photos

signal sticker_placed(sticker_id: String, position: Vector2)
signal sticker_removed(sticker_id: String)
signal decoration_saved(path: String)
signal decoration_cancelled

@onready var sticker_panel: PanelContainer = $StickerPanel
@onready var category_container: HBoxContainer = $StickerPanel/VBox/CategoryTabs
@onready var sticker_grid: GridContainer = $StickerPanel/VBox/StickerScroll/StickerGrid
@onready var controls_panel: PanelContainer = $ControlsPanel
@onready var save_button: Button = $ControlsPanel/VBox/SaveButton
@onready var clear_button: Button = $ControlsPanel/VBox/ClearButton
@onready var done_button: Button = $ControlsPanel/VBox/DoneButton
@onready var cancel_button: Button = $ControlsPanel/VBox/CancelButton
@onready var sticker_canvas: Control = $StickerCanvas
@onready var info_label: Label = $InfoLabel

var _is_visible: bool = false
var _placed_stickers: Array[Control] = []
var _selected_sticker_id: String = ""
var _dragging_sticker: Control = null
var _drag_offset: Vector2 = Vector2.ZERO
var _current_category: String = "basic"

# Placeholder texture for stickers without sprites
var _placeholder_texture: Texture2D = null


func _ready() -> void:
    save_button.pressed.connect(_on_save_pressed)
    clear_button.pressed.connect(_on_clear_pressed)
    done_button.pressed.connect(_on_done_pressed)
    cancel_button.pressed.connect(_on_cancel_pressed)
    
    _create_placeholder_texture()
    hide_sticker_ui()


func _create_placeholder_texture() -> void:
    # Create a simple 16x16 placeholder image
    var image := Image.create(16, 16, false, Image.FORMAT_RGBA8)
    image.fill(Color(1, 0.5, 0.8, 0.8))  # Pink placeholder
    _placeholder_texture = ImageTexture.create_from_image(image)


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    # Handle drag events
    if event is InputEventMouseButton:
        var mouse_event := event as InputEventMouseButton
        if mouse_event.button_index == MOUSE_BUTTON_LEFT:
            if mouse_event.pressed:
                _start_drag(mouse_event.position)
            else:
                _end_drag()
    
    if event is InputEventMouseMotion and _dragging_sticker != null:
        var motion := event as InputEventMouseMotion
        _update_drag(motion.position)
    
    # Handle cancel to exit
    if event.is_action_pressed("cancel"):
        _on_cancel_pressed()
        get_viewport().set_input_as_handled()


## Show the sticker UI
func show_sticker_ui() -> void:
    _is_visible = true
    visible = true
    sticker_panel.visible = true
    controls_panel.visible = true
    sticker_canvas.visible = true
    
    _populate_categories()
    _populate_stickers(_current_category)
    _update_info_label()


## Hide the sticker UI
func hide_sticker_ui() -> void:
    _is_visible = false
    visible = false


func _populate_categories() -> void:
    # Clear existing category buttons
    for child in category_container.get_children():
        child.queue_free()
    
    var categories = StickerManager.get_categories()
    for category in categories:
        var btn := Button.new()
        btn.text = category.name
        btn.toggle_mode = true
        btn.button_pressed = (category.id == _current_category)
        btn.pressed.connect(_on_category_selected.bind(category.id))
        category_container.add_child(btn)


func _populate_stickers(category_id: String) -> void:
    # Clear existing sticker buttons
    for child in sticker_grid.get_children():
        child.queue_free()
    
    var stickers = StickerManager.get_unlocked_stickers_by_category(category_id)
    for sticker in stickers:
        var btn := Button.new()
        btn.custom_minimum_size = Vector2(24, 24)
        btn.tooltip_text = sticker.name
        
        # Try to load sticker texture
        var texture: Texture2D = null
        var sprite_path: String = sticker.get("sprite_path", "")
        if sprite_path != "" and ResourceLoader.exists(sprite_path):
            texture = load(sprite_path)
        
        if texture != null:
            btn.icon = texture
        else:
            btn.text = sticker.name.substr(0, 2)
        
        btn.pressed.connect(_on_sticker_selected.bind(sticker.id))
        sticker_grid.add_child(btn)
    
    if stickers.is_empty():
        var label := Label.new()
        label.text = "No stickers"
        label.add_theme_font_size_override("font_size", 8)
        sticker_grid.add_child(label)


func _on_category_selected(category_id: String) -> void:
    _current_category = category_id
    _populate_categories()  # Update button states
    _populate_stickers(category_id)


func _on_sticker_selected(sticker_id: String) -> void:
    _selected_sticker_id = sticker_id
    _add_sticker_to_canvas(sticker_id)


func _add_sticker_to_canvas(sticker_id: String) -> void:
    var sticker_data = StickerManager.get_sticker(sticker_id)
    if sticker_data.is_empty():
        return
    
    # Create sticker sprite
    var sticker_node := TextureRect.new()
    sticker_node.name = "Sticker_" + sticker_id + "_" + str(_placed_stickers.size())
    sticker_node.set_meta("sticker_id", sticker_id)
    
    # Try to load texture
    var sprite_path: String = sticker_data.get("sprite_path", "")
    if sprite_path != "" and ResourceLoader.exists(sprite_path):
        sticker_node.texture = load(sprite_path)
    else:
        sticker_node.texture = _placeholder_texture
    
    sticker_node.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    sticker_node.custom_minimum_size = Vector2(24, 24)
    sticker_node.size = Vector2(24, 24)
    
    # Place at center of canvas
    var canvas_size := sticker_canvas.size
    sticker_node.position = (canvas_size - sticker_node.size) / 2
    
    sticker_canvas.add_child(sticker_node)
    _placed_stickers.append(sticker_node)
    
    sticker_placed.emit(sticker_id, sticker_node.position)
    _update_info_label()


func _start_drag(pos: Vector2) -> void:
    # Check if clicking on a placed sticker
    for sticker in _placed_stickers:
        if not is_instance_valid(sticker):
            continue
        var sticker_rect := Rect2(sticker.global_position, sticker.size)
        if sticker_rect.has_point(pos):
            _dragging_sticker = sticker
            _drag_offset = pos - sticker.global_position
            return


func _update_drag(pos: Vector2) -> void:
    if _dragging_sticker != null and is_instance_valid(_dragging_sticker):
        _dragging_sticker.global_position = pos - _drag_offset


func _end_drag() -> void:
    _dragging_sticker = null


func _on_save_pressed() -> void:
    # Hide UI panels temporarily
    sticker_panel.visible = false
    controls_panel.visible = false
    info_label.visible = false
    
    # Wait for render
    await get_tree().process_frame
    
    # Take screenshot with stickers
    var path := await PhotoModeManager.take_photo()
    
    # Restore UI
    sticker_panel.visible = true
    controls_panel.visible = true
    info_label.visible = true
    
    if path != "":
        decoration_saved.emit(path)
        print("[PhotoSticker] Saved decorated photo: " + path)


func _on_clear_pressed() -> void:
    # Remove all placed stickers
    for sticker in _placed_stickers:
        if is_instance_valid(sticker):
            var sticker_id: String = sticker.get_meta("sticker_id", "")
            sticker_removed.emit(sticker_id)
            sticker.queue_free()
    _placed_stickers.clear()
    _update_info_label()


func _on_done_pressed() -> void:
    # Save and exit
    await _on_save_pressed()
    _cleanup_and_exit()


func _on_cancel_pressed() -> void:
    decoration_cancelled.emit()
    _cleanup_and_exit()


func _cleanup_and_exit() -> void:
    # Clear stickers
    for sticker in _placed_stickers:
        if is_instance_valid(sticker):
            sticker.queue_free()
    _placed_stickers.clear()
    
    hide_sticker_ui()
    PhotoModeManager.exit_photo_mode()


func _update_info_label() -> void:
    var count := _placed_stickers.size()
    info_label.text = "Stickers: %d | Drag to move" % count


## Get count of placed stickers
func get_placed_sticker_count() -> int:
    return _placed_stickers.size()


## Check if sticker UI is visible
func is_sticker_mode_active() -> bool:
    return _is_visible
