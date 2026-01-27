extends CanvasLayer

## ControlsOverlay - Shows game controls overlay when F1 or help button pressed
## Also accessible from pause menu or on first game start

signal overlay_opened
signal overlay_closed

const CONTROLS: Array[Dictionary] = [
    {"action": "Movement", "keys": "Arrow Keys / WASD"},
    {"action": "Interact / Confirm", "keys": "E / Space / Enter"},
    {"action": "Cancel / Back", "keys": "Escape"},
    {"action": "Pause Menu", "keys": "Escape / P"},
    {"action": "Debug Console", "keys": "` (Backtick)"},
]

var _is_active: bool = false

@onready var panel: Panel = $Panel
@onready var dimmer: ColorRect = $Dimmer
@onready var title_label: Label = $Panel/TitleLabel
@onready var controls_container: VBoxContainer = $Panel/ControlsContainer
@onready var close_hint: Label = $Panel/CloseHint

func _ready() -> void:
    layer = 120  # Above most UI
    process_mode = Node.PROCESS_MODE_ALWAYS
    _setup_ui()
    visible = false

func _setup_ui() -> void:
    # Create dimmer
    dimmer = ColorRect.new()
    dimmer.name = "Dimmer"
    dimmer.color = Color(0, 0, 0, 0.6)
    dimmer.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(dimmer)
    
    # Create panel
    panel = Panel.new()
    panel.name = "Panel"
    panel.custom_minimum_size = Vector2(280, 200)
    panel.set_anchors_preset(Control.PRESET_CENTER)
    panel.size = Vector2(280, 200)
    panel.position = Vector2(-140, -100)
    add_child(panel)
    
    # Create title
    title_label = Label.new()
    title_label.name = "TitleLabel"
    title_label.text = "CONTROLS"
    title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    title_label.position = Vector2(10, 8)
    title_label.size = Vector2(260, 20)
    panel.add_child(title_label)
    
    # Create container for controls
    controls_container = VBoxContainer.new()
    controls_container.name = "ControlsContainer"
    controls_container.position = Vector2(10, 32)
    controls_container.size = Vector2(260, 140)
    panel.add_child(controls_container)
    
    # Populate controls
    for control_def in CONTROLS:
        var row := HBoxContainer.new()
        row.custom_minimum_size = Vector2(260, 20)
        
        var action_label := Label.new()
        action_label.text = control_def["action"]
        action_label.custom_minimum_size = Vector2(120, 20)
        action_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        row.add_child(action_label)
        
        var keys_label := Label.new()
        keys_label.text = control_def["keys"]
        keys_label.custom_minimum_size = Vector2(130, 20)
        keys_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
        row.add_child(keys_label)
        
        controls_container.add_child(row)
    
    # Create close hint
    close_hint = Label.new()
    close_hint.name = "CloseHint"
    close_hint.text = "Press ESC or F1 to close"
    close_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    close_hint.position = Vector2(10, 175)
    close_hint.size = Vector2(260, 20)
    close_hint.modulate = Color(0.7, 0.7, 0.7)
    panel.add_child(close_hint)

func _input(event: InputEvent) -> void:
    # F1 to toggle controls overlay
    if event is InputEventKey and event.pressed and event.physical_keycode == KEY_F1:
        if _is_active:
            close_overlay()
        else:
            open_overlay()
        get_viewport().set_input_as_handled()
        return
    
    # ESC to close if open
    if _is_active and event.is_action_pressed("cancel"):
        close_overlay()
        get_viewport().set_input_as_handled()

func open_overlay() -> void:
    if _is_active:
        return
    
    _is_active = true
    visible = true
    overlay_opened.emit()
    print("[ControlsOverlay] Opened")
    
    # Announce for screen readers
    if is_instance_valid(AccessibilityManager) and AccessibilityManager.screen_reader_enabled:
        AccessibilityManager.announce("Controls overlay. Press Escape or F1 to close.")

func close_overlay() -> void:
    if not _is_active:
        return
    
    _is_active = false
    visible = false
    overlay_closed.emit()
    print("[ControlsOverlay] Closed")

func is_open() -> bool:
    return _is_active

## Show on first launch if player hasn't seen controls before
func show_if_first_time() -> void:
    var seen_controls: bool = SettingsManager.get_setting("seen_controls", false)
    if not seen_controls:
        open_overlay()
        SettingsManager.set_setting("seen_controls", true)
