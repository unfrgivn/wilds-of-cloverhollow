extends CanvasLayer
## Art gallery viewer with zoom/pan controls.

signal gallery_closed

var _panel: PanelContainer
var _category_tabs: HBoxContainer
var _art_grid: GridContainer
var _preview_panel: PanelContainer
var _preview_image: TextureRect
var _preview_name: Label
var _preview_desc: Label
var _close_button: Button
var _zoom_slider: HSlider
var _current_category: String = "characters"
var _viewing_art: bool = false


func _ready() -> void:
    layer = 100
    process_mode = Node.PROCESS_MODE_ALWAYS
    add_to_group("art_gallery_ui")
    _build_ui()
    _populate_gallery()


func _build_ui() -> void:
    # Background
    var bg = ColorRect.new()
    bg.color = Color(0.05, 0.05, 0.1, 0.95)
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(bg)
    
    # Main container
    var main_vbox = VBoxContainer.new()
    main_vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
    main_vbox.set_anchor_and_offset(SIDE_LEFT, 0, 20)
    main_vbox.set_anchor_and_offset(SIDE_RIGHT, 1, -20)
    main_vbox.set_anchor_and_offset(SIDE_TOP, 0, 15)
    main_vbox.set_anchor_and_offset(SIDE_BOTTOM, 1, -15)
    main_vbox.add_theme_constant_override("separation", 10)
    add_child(main_vbox)
    
    # Title
    var title = Label.new()
    title.text = "🎨 Art Gallery"
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    title.add_theme_font_size_override("font_size", 16)
    main_vbox.add_child(title)
    
    # Category tabs
    _category_tabs = HBoxContainer.new()
    _category_tabs.alignment = BoxContainer.ALIGNMENT_CENTER
    _category_tabs.add_theme_constant_override("separation", 10)
    main_vbox.add_child(_category_tabs)
    
    for category in ArtGalleryManager.CATEGORIES:
        var btn = Button.new()
        btn.text = category.capitalize()
        btn.pressed.connect(_on_category_selected.bind(category))
        _category_tabs.add_child(btn)
    
    # Content area (split: grid | preview)
    var content_hbox = HBoxContainer.new()
    content_hbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
    content_hbox.add_theme_constant_override("separation", 15)
    main_vbox.add_child(content_hbox)
    
    # Art grid (scroll)
    var scroll = ScrollContainer.new()
    scroll.custom_minimum_size = Vector2(200, 150)
    scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    content_hbox.add_child(scroll)
    
    _art_grid = GridContainer.new()
    _art_grid.columns = 3
    _art_grid.add_theme_constant_override("h_separation", 8)
    _art_grid.add_theme_constant_override("v_separation", 8)
    scroll.add_child(_art_grid)
    
    # Preview panel
    _preview_panel = PanelContainer.new()
    _preview_panel.custom_minimum_size = Vector2(200, 150)
    content_hbox.add_child(_preview_panel)
    
    var preview_vbox = VBoxContainer.new()
    preview_vbox.add_theme_constant_override("separation", 5)
    _preview_panel.add_child(preview_vbox)
    
    var preview_margin = MarginContainer.new()
    preview_margin.add_theme_constant_override("margin_left", 10)
    preview_margin.add_theme_constant_override("margin_right", 10)
    preview_margin.add_theme_constant_override("margin_top", 10)
    preview_margin.add_theme_constant_override("margin_bottom", 10)
    _preview_panel.add_child(preview_margin)
    
    var inner_vbox = VBoxContainer.new()
    inner_vbox.add_theme_constant_override("separation", 8)
    preview_margin.add_child(inner_vbox)
    
    _preview_image = TextureRect.new()
    _preview_image.custom_minimum_size = Vector2(160, 100)
    _preview_image.expand_mode = TextureRect.EXPAND_FIT_WIDTH_PROPORTIONAL
    _preview_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    inner_vbox.add_child(_preview_image)
    
    _preview_name = Label.new()
    _preview_name.text = "Select an artwork"
    _preview_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _preview_name.add_theme_font_size_override("font_size", 12)
    inner_vbox.add_child(_preview_name)
    
    _preview_desc = Label.new()
    _preview_desc.text = ""
    _preview_desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _preview_desc.add_theme_font_size_override("font_size", 9)
    _preview_desc.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
    _preview_desc.autowrap_mode = TextServer.AUTOWRAP_WORD
    inner_vbox.add_child(_preview_desc)
    
    # Zoom slider
    var zoom_hbox = HBoxContainer.new()
    zoom_hbox.add_theme_constant_override("separation", 5)
    inner_vbox.add_child(zoom_hbox)
    
    var zoom_label = Label.new()
    zoom_label.text = "Zoom:"
    zoom_label.add_theme_font_size_override("font_size", 9)
    zoom_hbox.add_child(zoom_label)
    
    _zoom_slider = HSlider.new()
    _zoom_slider.min_value = 0.5
    _zoom_slider.max_value = 2.0
    _zoom_slider.value = 1.0
    _zoom_slider.step = 0.1
    _zoom_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    _zoom_slider.value_changed.connect(_on_zoom_changed)
    zoom_hbox.add_child(_zoom_slider)
    
    # Progress
    var progress_label = Label.new()
    progress_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    progress_label.add_theme_font_size_override("font_size", 9)
    progress_label.add_theme_color_override("font_color", Color(0.6, 0.8, 0.6))
    var pct := ArtGalleryManager.get_completion_percent()
    progress_label.text = "Collection: %d/%d (%.0f%%)" % [ArtGalleryManager.get_unlocked_count(), ArtGalleryManager.get_total_count(), pct]
    main_vbox.add_child(progress_label)
    
    # Close button
    _close_button = Button.new()
    _close_button.text = "Close"
    _close_button.pressed.connect(_close)
    main_vbox.add_child(_close_button)
    
    _update_category_buttons()


func _populate_gallery() -> void:
    """Populate art grid with current category."""
    for child in _art_grid.get_children():
        child.queue_free()
    
    var art_list := ArtGalleryManager.get_art_by_category(_current_category)
    
    for art in art_list:
        var btn = Button.new()
        btn.custom_minimum_size = Vector2(50, 50)
        
        if ArtGalleryManager.is_art_unlocked(art["id"]):
            btn.text = "🖼️"
            btn.pressed.connect(_on_art_selected.bind(art))
        else:
            btn.text = "🔒"
            btn.disabled = true
        
        btn.add_theme_font_size_override("font_size", 20)
        _art_grid.add_child(btn)


func _update_category_buttons() -> void:
    """Update category button states."""
    var idx := 0
    for child in _category_tabs.get_children():
        if child is Button:
            child.disabled = (ArtGalleryManager.CATEGORIES[idx] == _current_category)
            idx += 1


func _on_category_selected(category: String) -> void:
    _current_category = category
    _update_category_buttons()
    _populate_gallery()


func _on_art_selected(art: Dictionary) -> void:
    _preview_name.text = art.get("name", "Unknown")
    _preview_desc.text = art.get("description", "")
    
    # Load preview image
    var texture_path: String = art.get("path", "")
    if ResourceLoader.exists(texture_path):
        _preview_image.texture = load(texture_path)
    else:
        _preview_image.texture = null


func _on_zoom_changed(value: float) -> void:
    _preview_image.scale = Vector2(value, value)


func _close() -> void:
    get_tree().paused = false
    gallery_closed.emit()
    queue_free()


func _input(event: InputEvent) -> void:
    if event.is_action_pressed("cancel") or event.is_action_pressed("pause"):
        get_viewport().set_input_as_handled()
        _close()


func show_gallery() -> void:
    """Called to display the gallery."""
    get_tree().paused = true
