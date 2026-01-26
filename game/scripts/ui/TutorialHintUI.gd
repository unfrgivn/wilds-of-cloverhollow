extends CanvasLayer

## TutorialHintUI - Displays contextual tutorial hints with dismiss button

signal hint_dismissed

@onready var panel: PanelContainer = $Panel
@onready var title_label: Label = $Panel/VBox/TitleLabel
@onready var message_label: Label = $Panel/VBox/MessageLabel
@onready var dismiss_label: Label = $Panel/VBox/DismissLabel

var _is_visible: bool = false


func _ready() -> void:
    panel.modulate.a = 0.0
    panel.visible = false


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    # Dismiss on any action press
    if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_cancel"):
        hint_dismissed.emit()
        get_viewport().set_input_as_handled()


## Show a hint with title and message
func show_hint(title: String, message: String) -> void:
    title_label.text = title
    message_label.text = message
    
    panel.visible = true
    _is_visible = true
    
    # Fade in
    var tween := create_tween()
    tween.tween_property(panel, "modulate:a", 1.0, 0.2)
    
    print("[TutorialHintUI] Showing: %s" % title)


## Hide the current hint
func hide_hint() -> void:
    if not _is_visible:
        return
    
    _is_visible = false
    
    # Fade out
    var tween := create_tween()
    tween.tween_property(panel, "modulate:a", 0.0, 0.2)
    tween.tween_callback(func() -> void: panel.visible = false)
    
    print("[TutorialHintUI] Hidden")
