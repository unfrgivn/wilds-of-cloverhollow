extends CanvasLayer
## FurniturePlacementUI - Grid-based furniture placement for room customization

signal furniture_placed_ui(furniture_id: String, position: Vector2i)
signal furniture_removed_ui(index: int)
signal customization_closed

@onready var furniture_panel: PanelContainer = $FurniturePanel
@onready var category_container: HBoxContainer = $FurniturePanel/VBox/CategoryTabs
@onready var furniture_grid: GridContainer = $FurniturePanel/VBox/FurnitureScroll/FurnitureGrid
@onready var grid_display: Control = $GridDisplay
@onready var controls_panel: PanelContainer = $ControlsPanel
@onready var clear_button: Button = $ControlsPanel/VBox/ClearButton
@onready var done_button: Button = $ControlsPanel/VBox/DoneButton
@onready var info_label: Label = $InfoLabel

var _is_visible: bool = false
var _current_room_id: String = "hero_bedroom"
var _current_category: String = "bed"
var _selected_furniture_id: String = ""
var _grid_size: Vector2i = Vector2i(8, 6)
var _cell_size: int = 32  # Pixels per grid cell
var _placed_sprites: Array[Node] = []

# Placeholder texture
var _placeholder_texture: Texture2D = null


func _ready() -> void:
    clear_button.pressed.connect(_on_clear_pressed)
    done_button.pressed.connect(_on_done_pressed)
    
    _create_placeholder_texture()
    hide_ui()


func _create_placeholder_texture() -> void:
    var image := Image.create(16, 16, false, Image.FORMAT_RGBA8)
    image.fill(Color(0.6, 0.4, 0.2, 0.8))  # Brown placeholder
    _placeholder_texture = ImageTexture.create_from_image(image)


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    # Handle grid click for placement
    if event is InputEventMouseButton:
        var mouse_event := event as InputEventMouseButton
        if mouse_event.button_index == MOUSE_BUTTON_LEFT and mouse_event.pressed:
            _handle_grid_click(mouse_event.position)
    
    # Handle cancel to exit
    if event.is_action_pressed("cancel"):
        _on_done_pressed()
        get_viewport().set_input_as_handled()


## Show the furniture placement UI for a room
func show_ui(room_id: String = "hero_bedroom") -> void:
    _current_room_id = room_id
    _is_visible = true
    visible = true
    
    # Load room data
    var room_data = HomeCustomizationManager.get_room(room_id)
    if not room_data.is_empty():
        var grid_size_data = room_data.get("grid_size", {"width": 8, "height": 6})
        _grid_size = Vector2i(grid_size_data.width, grid_size_data.height)
    
    _populate_categories()
    _populate_furniture(_current_category)
    _refresh_placed_furniture()
    _update_info_label()
    
    get_tree().paused = true


## Hide the UI
func hide_ui() -> void:
    _is_visible = false
    visible = false
    get_tree().paused = false


func _populate_categories() -> void:
    for child in category_container.get_children():
        child.queue_free()
    
    var categories = HomeCustomizationManager.get_categories()
    for category in categories:
        var btn := Button.new()
        btn.text = category.name.substr(0, 4)  # Short label
        btn.toggle_mode = true
        btn.button_pressed = (category.id == _current_category)
        btn.pressed.connect(_on_category_selected.bind(category.id))
        category_container.add_child(btn)


func _populate_furniture(category_id: String) -> void:
    for child in furniture_grid.get_children():
        child.queue_free()
    
    var furniture_list = HomeCustomizationManager.get_unlocked_furniture()
    for furn in furniture_list:
        if furn.get("category", "") != category_id:
            continue
        
        var btn := Button.new()
        btn.custom_minimum_size = Vector2(32, 32)
        btn.tooltip_text = furn.name
        btn.toggle_mode = true
        btn.button_pressed = (furn.id == _selected_furniture_id)
        
        # Try to load texture
        var sprite_path: String = furn.get("sprite_path", "")
        if sprite_path != "" and ResourceLoader.exists(sprite_path):
            btn.icon = load(sprite_path)
        else:
            btn.text = furn.name.substr(0, 2)
        
        btn.pressed.connect(_on_furniture_selected.bind(furn.id))
        furniture_grid.add_child(btn)
    
    if furniture_grid.get_child_count() == 0:
        var label := Label.new()
        label.text = "None"
        label.add_theme_font_size_override("font_size", 8)
        furniture_grid.add_child(label)


func _on_category_selected(category_id: String) -> void:
    _current_category = category_id
    _selected_furniture_id = ""
    _populate_categories()
    _populate_furniture(category_id)


func _on_furniture_selected(furniture_id: String) -> void:
    _selected_furniture_id = furniture_id
    _populate_furniture(_current_category)  # Update selection state
    _update_info_label()


func _handle_grid_click(mouse_pos: Vector2) -> void:
    # Check if click is on grid area
    var grid_origin := grid_display.global_position
    var grid_rect := Rect2(grid_origin, Vector2(_grid_size.x * _cell_size, _grid_size.y * _cell_size))
    
    if not grid_rect.has_point(mouse_pos):
        return
    
    # Convert to grid position
    var local_pos := mouse_pos - grid_origin
    var grid_pos := Vector2i(int(local_pos.x / _cell_size), int(local_pos.y / _cell_size))
    
    if _selected_furniture_id != "":
        # Place furniture
        var success := HomeCustomizationManager.place_furniture(_current_room_id, _selected_furniture_id, grid_pos)
        if success:
            _refresh_placed_furniture()
            _update_info_label()
            furniture_placed_ui.emit(_selected_furniture_id, grid_pos)


func _refresh_placed_furniture() -> void:
    # Clear existing sprites
    for sprite in _placed_sprites:
        if is_instance_valid(sprite):
            sprite.queue_free()
    _placed_sprites.clear()
    
    # Get placements
    var placements = HomeCustomizationManager.get_room_placements(_current_room_id)
    var grid_origin := grid_display.position
    
    for i in range(placements.size()):
        var placement = placements[i]
        var furn_data = HomeCustomizationManager.get_furniture(placement.furniture_id)
        if furn_data.is_empty():
            continue
        
        var sprite := TextureRect.new()
        sprite.name = "Placed_" + str(i)
        sprite.set_meta("placement_index", i)
        
        # Try to load texture
        var sprite_path: String = furn_data.get("sprite_path", "")
        if sprite_path != "" and ResourceLoader.exists(sprite_path):
            sprite.texture = load(sprite_path)
        else:
            sprite.texture = _placeholder_texture
        
        var size_data = furn_data.get("size", {"width": 1, "height": 1})
        sprite.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
        sprite.size = Vector2(size_data.width * _cell_size, size_data.height * _cell_size)
        sprite.position = Vector2(placement.position.x * _cell_size, placement.position.y * _cell_size) + grid_origin
        
        grid_display.add_child(sprite)
        _placed_sprites.append(sprite)


func _on_clear_pressed() -> void:
    HomeCustomizationManager.clear_room(_current_room_id)
    _refresh_placed_furniture()
    _update_info_label()


func _on_done_pressed() -> void:
    customization_closed.emit()
    hide_ui()


func _update_info_label() -> void:
    var placements = HomeCustomizationManager.get_room_placements(_current_room_id)
    var selected_text := ""
    if _selected_furniture_id != "":
        var furn = HomeCustomizationManager.get_furniture(_selected_furniture_id)
        selected_text = " | Selected: " + furn.get("name", "?")
    info_label.text = "Furniture: %d%s" % [placements.size(), selected_text]


## Get placed furniture count
func get_placed_count() -> int:
    return HomeCustomizationManager.get_room_placements(_current_room_id).size()


## Check if UI is visible
func is_customization_active() -> bool:
    return _is_visible
