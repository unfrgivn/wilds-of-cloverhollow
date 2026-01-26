extends CanvasLayer
## TitleScreen - Game title screen with start option

signal start_pressed

@onready var title_label: Label = $Panel/TitleLabel
@onready var start_button: Button = $Panel/StartButton
@onready var fade_rect: ColorRect = $FadeRect


func _ready() -> void:
    start_button.pressed.connect(_on_start_pressed)
    fade_rect.color = Color(0, 0, 0, 1)
    _fade_in()


func _fade_in() -> void:
    var tween := create_tween()
    tween.tween_property(fade_rect, "color:a", 0.0, 1.0)


func _on_start_pressed() -> void:
    start_button.disabled = true
    _fade_out_and_start()


func _fade_out_and_start() -> void:
    var tween := create_tween()
    tween.tween_property(fade_rect, "color:a", 1.0, 1.0)
    tween.tween_callback(_emit_start)


func _emit_start() -> void:
    start_pressed.emit()
