extends CanvasLayer
## CutsceneUI - Visual overlay for cutscene playback
## Shows text, speaker, skip hint, and handles visual effects

@onready var background: ColorRect = $Background
@onready var text_panel: PanelContainer = $TextPanel
@onready var speaker_label: Label = $TextPanel/VBox/SpeakerLabel
@onready var text_label: Label = $TextPanel/VBox/TextLabel
@onready var skip_label: Label = $SkipLabel
@onready var flash_overlay: ColorRect = $FlashOverlay

var _can_skip: bool = true
var _is_visible: bool = false
var _typewriter_tween: Tween = null
var _flash_tween: Tween = null
var _shake_tween: Tween = null
var _original_position: Vector2 = Vector2.ZERO


func _ready() -> void:
    CutsceneManager.register_ui(self)
    _original_position = text_panel.position
    hide_cutscene()


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    # Handle skip request
    if _can_skip and event.is_action_pressed("cancel"):
        CutsceneManager.skip_cutscene()
        get_viewport().set_input_as_handled()
        return
    
    # Handle advance (tap/click/accept to continue faster)
    if event.is_action_pressed("interact") or event.is_action_pressed("accept"):
        # If typewriter is in progress, complete it
        if _typewriter_tween != null and _typewriter_tween.is_running():
            _typewriter_tween.kill()
            text_label.visible_ratio = 1.0
        else:
            # Otherwise advance to next step
            CutsceneManager.advance_step()
        get_viewport().set_input_as_handled()


## Show the cutscene UI with initial setup
func show_cutscene(cutscene: Dictionary, can_skip: bool) -> void:
    _can_skip = can_skip
    _is_visible = true
    
    # Set background color
    var bg_color_str := cutscene.get("background_color", "#000000") as String
    background.color = Color.html(bg_color_str)
    
    # Show/hide skip hint
    skip_label.visible = can_skip
    skip_label.text = "Press Cancel to skip"
    
    # Show elements
    visible = true
    background.visible = true
    text_panel.visible = true
    flash_overlay.visible = false
    flash_overlay.modulate.a = 0
    
    # Fade in
    var tween := create_tween()
    background.modulate.a = 0
    text_panel.modulate.a = 0
    skip_label.modulate.a = 0
    tween.tween_property(background, "modulate:a", 1.0, 0.3)
    tween.parallel().tween_property(text_panel, "modulate:a", 1.0, 0.3)
    tween.parallel().tween_property(skip_label, "modulate:a", 0.6, 0.3)


## Show a text step with optional speaker
func show_step_text(speaker: String, text: String) -> void:
    if speaker.is_empty():
        speaker_label.visible = false
    else:
        speaker_label.visible = true
        speaker_label.text = speaker
    
    text_label.text = text
    text_label.visible_ratio = 0.0
    
    # Typewriter effect
    if _typewriter_tween != null and _typewriter_tween.is_running():
        _typewriter_tween.kill()
    
    _typewriter_tween = create_tween()
    var char_count := text.length()
    var duration := maxf(0.5, char_count * 0.03)
    _typewriter_tween.tween_property(text_label, "visible_ratio", 1.0, duration)


## Play screen shake effect
func play_shake(intensity: int, duration: float) -> void:
    if _shake_tween != null and _shake_tween.is_running():
        _shake_tween.kill()
    
    _shake_tween = create_tween()
    var shake_count := int(duration / 0.05)
    
    for i in range(shake_count):
        var offset := Vector2(
            randf_range(-intensity, intensity),
            randf_range(-intensity, intensity)
        )
        _shake_tween.tween_property(text_panel, "position", _original_position + offset, 0.05)
    
    _shake_tween.tween_property(text_panel, "position", _original_position, 0.05)


## Play screen flash effect
func play_flash(color_str: String, duration: float) -> void:
    var flash_color := Color.html(color_str)
    flash_overlay.color = flash_color
    flash_overlay.visible = true
    
    if _flash_tween != null and _flash_tween.is_running():
        _flash_tween.kill()
    
    _flash_tween = create_tween()
    flash_overlay.modulate.a = 0
    _flash_tween.tween_property(flash_overlay, "modulate:a", 1.0, duration * 0.3)
    _flash_tween.tween_property(flash_overlay, "modulate:a", 0.0, duration * 0.7)
    _flash_tween.tween_callback(func(): flash_overlay.visible = false)


## Hide the cutscene UI
func hide_cutscene() -> void:
    _is_visible = false
    
    # Kill any active tweens
    if _typewriter_tween != null and _typewriter_tween.is_running():
        _typewriter_tween.kill()
    if _flash_tween != null and _flash_tween.is_running():
        _flash_tween.kill()
    if _shake_tween != null and _shake_tween.is_running():
        _shake_tween.kill()
    
    # Fade out
    var tween := create_tween()
    tween.tween_property(background, "modulate:a", 0.0, 0.3)
    tween.parallel().tween_property(text_panel, "modulate:a", 0.0, 0.3)
    tween.parallel().tween_property(skip_label, "modulate:a", 0.0, 0.3)
    tween.tween_callback(func(): visible = false)
