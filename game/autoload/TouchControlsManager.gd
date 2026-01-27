extends Node
## TouchControlsManager autoload.
## Automatically injects touch controls into the scene tree when on mobile.
## Controls are shown in overworld areas and hidden during battles/menus.
## Supports one-handed mode for compact right-side layout.

const TOUCH_CONTROLS_SCENE := preload("res://game/scenes/ui/TouchControls.tscn")

var _touch_controls: CanvasLayer = null
var _is_mobile: bool = false


func _ready() -> void:
    # Detect if we're on mobile (iOS/Android) or if touch is emulated
    _is_mobile = _detect_mobile()
    if _is_mobile:
        _spawn_touch_controls()
    # Connect to one-handed mode setting changes
    SettingsManager.one_handed_mode_changed.connect(_on_one_handed_mode_changed)


func _detect_mobile() -> bool:
    # Check platform
    var os_name := OS.get_name()
    if os_name in ["iOS", "Android"]:
        return true
    # Also enable if touch screen is available (for testing on desktop)
    if DisplayServer.is_touchscreen_available():
        return true
    return false


func _spawn_touch_controls() -> void:
    if _touch_controls != null:
        return
    _touch_controls = TOUCH_CONTROLS_SCENE.instantiate()
    add_child(_touch_controls)
    # Apply initial layout based on current setting
    _apply_one_handed_layout(SettingsManager.one_handed_mode_enabled)


func show_controls() -> void:
    if _touch_controls:
        _touch_controls.visible = true


func hide_controls() -> void:
    if _touch_controls:
        _touch_controls.visible = false


func is_mobile() -> bool:
    return _is_mobile


func is_one_handed_mode() -> bool:
    return SettingsManager.one_handed_mode_enabled


func _on_one_handed_mode_changed(enabled: bool) -> void:
    _apply_one_handed_layout(enabled)


func _apply_one_handed_layout(enabled: bool) -> void:
    if _touch_controls == null:
        return
    
    var hbox: HBoxContainer = _touch_controls.get_node_or_null("SafeMargin/HBox")
    if hbox == null:
        return
    
    var left_spacer: Control = hbox.get_node_or_null("LeftSpacer")
    var middle_spacer: Control = hbox.get_node_or_null("MiddleSpacer")
    var joystick_container: Control = hbox.get_node_or_null("JoystickContainer")
    var button_container: Control = hbox.get_node_or_null("ButtonContainer")
    
    if enabled:
        # One-handed mode: compact right-side layout
        # Hide left and middle spacers, move joystick next to button
        if left_spacer:
            left_spacer.visible = false
        if middle_spacer:
            middle_spacer.visible = false
        # Make controls smaller
        if joystick_container:
            joystick_container.custom_minimum_size = Vector2(80, 80)
        if button_container:
            button_container.custom_minimum_size = Vector2(60, 60)
        print("[TouchControlsManager] One-handed mode enabled: compact layout")
    else:
        # Standard mode: full spread layout
        if left_spacer:
            left_spacer.visible = true
        if middle_spacer:
            middle_spacer.visible = true
        # Restore normal control sizes
        if joystick_container:
            joystick_container.custom_minimum_size = Vector2(120, 120)
        if button_container:
            button_container.custom_minimum_size = Vector2(80, 80)
        print("[TouchControlsManager] Standard mode: full layout")
