extends CanvasLayer
## Scrolling credits display with character vignettes.

signal credits_finished
signal credits_skipped

const SCROLL_SPEED: float = 40.0  # Pixels per second
const SECTION_SPACING: float = 60.0
const ENTRY_SPACING: float = 30.0
const VIGNETTE_DURATION: float = 4.0
const FADE_DURATION: float = 1.0

var _credits_data: Dictionary = {}
var _can_skip: bool = true
var _scroll_container: Control
var _credits_content: VBoxContainer
var _vignette_panel: PanelContainer
var _vignette_label: Label
var _skip_hint: Label
var _is_scrolling: bool = false
var _scroll_position: float = 0.0
var _total_height: float = 0.0
var _current_vignette: int = 0
var _showing_vignettes: bool = false
var _finished: bool = false


func _ready() -> void:
    layer = 100
    process_mode = Node.PROCESS_MODE_ALWAYS
    _build_ui()


func _build_ui() -> void:
    # Background
    var bg = ColorRect.new()
    bg.color = Color(0.05, 0.05, 0.1, 1.0)
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(bg)
    
    # Scroll container
    _scroll_container = Control.new()
    _scroll_container.set_anchors_preset(Control.PRESET_FULL_RECT)
    _scroll_container.clip_contents = true
    add_child(_scroll_container)
    
    # Credits content
    _credits_content = VBoxContainer.new()
    _credits_content.set_anchors_preset(Control.PRESET_CENTER_TOP)
    _credits_content.position.x = 256  # Center of 512
    _credits_content.add_theme_constant_override("separation", int(ENTRY_SPACING))
    _scroll_container.add_child(_credits_content)
    
    # Vignette panel (hidden initially)
    _vignette_panel = PanelContainer.new()
    _vignette_panel.set_anchors_preset(Control.PRESET_CENTER)
    _vignette_panel.position = Vector2(256, 144)
    _vignette_panel.visible = false
    _vignette_panel.modulate.a = 0.0
    add_child(_vignette_panel)
    
    var vignette_margin = MarginContainer.new()
    vignette_margin.add_theme_constant_override("margin_left", 20)
    vignette_margin.add_theme_constant_override("margin_right", 20)
    vignette_margin.add_theme_constant_override("margin_top", 15)
    vignette_margin.add_theme_constant_override("margin_bottom", 15)
    _vignette_panel.add_child(vignette_margin)
    
    _vignette_label = Label.new()
    _vignette_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _vignette_label.add_theme_font_size_override("font_size", 14)
    vignette_margin.add_child(_vignette_label)
    
    # Skip hint
    _skip_hint = Label.new()
    _skip_hint.text = "Press any key to skip"
    _skip_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _skip_hint.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
    _skip_hint.position.y = 270
    _skip_hint.add_theme_font_size_override("font_size", 8)
    _skip_hint.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
    add_child(_skip_hint)


func start_credits(data: Dictionary, can_skip: bool = true) -> void:
    """Initialize and start credits display."""
    _credits_data = data
    _can_skip = can_skip
    _skip_hint.visible = can_skip
    
    _build_credits_content()
    
    # Start below screen
    _credits_content.position.y = 288
    _scroll_position = 288
    _is_scrolling = true


func _build_credits_content() -> void:
    """Build the scrolling credits labels."""
    # Title
    if _credits_data.has("title"):
        var title = Label.new()
        title.text = _credits_data["title"]
        title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
        title.add_theme_font_size_override("font_size", 24)
        title.add_theme_color_override("font_color", Color(1.0, 0.9, 0.5))
        _credits_content.add_child(title)
        
        # Spacer after title
        var spacer = Control.new()
        spacer.custom_minimum_size.y = SECTION_SPACING
        _credits_content.add_child(spacer)
    
    # Sections
    if _credits_data.has("sections"):
        for section in _credits_data["sections"]:
            # Section header
            var header = Label.new()
            header.text = section.get("header", "")
            header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
            header.add_theme_font_size_override("font_size", 14)
            header.add_theme_color_override("font_color", Color(0.8, 0.8, 1.0))
            _credits_content.add_child(header)
            
            # Section entries
            for entry_text in section.get("entries", []):
                var entry = Label.new()
                entry.text = entry_text
                entry.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
                entry.add_theme_font_size_override("font_size", 10)
                _credits_content.add_child(entry)
            
            # Spacer after section
            var spacer = Control.new()
            spacer.custom_minimum_size.y = SECTION_SPACING / 2
            _credits_content.add_child(spacer)
    
    # End message
    if _credits_data.has("end_message"):
        var spacer = Control.new()
        spacer.custom_minimum_size.y = SECTION_SPACING
        _credits_content.add_child(spacer)
        
        var end_msg = Label.new()
        end_msg.text = _credits_data["end_message"]
        end_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
        end_msg.add_theme_font_size_override("font_size", 16)
        end_msg.add_theme_color_override("font_color", Color(1.0, 1.0, 0.8))
        _credits_content.add_child(end_msg)
    
    # Calculate total height after building
    await get_tree().process_frame
    _total_height = _credits_content.size.y


func _process(delta: float) -> void:
    if _finished:
        return
    
    if _is_scrolling:
        _scroll_position -= SCROLL_SPEED * delta
        _credits_content.position.y = _scroll_position
        
        # Check if scrolling complete (content fully scrolled past top)
        if _scroll_position < -_total_height - 50:
            _is_scrolling = false
            _start_vignettes()


func _input(event: InputEvent) -> void:
    if not _can_skip:
        return
    
    if event is InputEventKey or event is InputEventScreenTouch:
        if event.is_pressed():
            skip()


func _start_vignettes() -> void:
    """Start showing character vignettes after scroll."""
    if not _credits_data.has("vignettes") or _credits_data["vignettes"].is_empty():
        _finish_credits()
        return
    
    _showing_vignettes = true
    _current_vignette = 0
    _scroll_container.visible = false
    _show_next_vignette()


func _show_next_vignette() -> void:
    """Display the next vignette."""
    if _current_vignette >= _credits_data["vignettes"].size():
        _finish_credits()
        return
    
    var vignette = _credits_data["vignettes"][_current_vignette]
    _vignette_label.text = vignette.get("text", "")
    _vignette_panel.visible = true
    
    # Fade in
    var tween = create_tween()
    tween.tween_property(_vignette_panel, "modulate:a", 1.0, FADE_DURATION)
    tween.tween_interval(VIGNETTE_DURATION)
    tween.tween_property(_vignette_panel, "modulate:a", 0.0, FADE_DURATION)
    tween.tween_callback(_on_vignette_done)


func _on_vignette_done() -> void:
    """Called when a vignette finishes."""
    _current_vignette += 1
    _show_next_vignette()


func _finish_credits() -> void:
    """Credits sequence complete."""
    _finished = true
    credits_finished.emit()


func skip() -> void:
    """Skip the credits."""
    if _finished:
        return
    _finished = true
    credits_skipped.emit()
