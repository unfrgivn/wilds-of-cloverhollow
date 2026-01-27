extends CanvasLayer
## SplashScreen - Studio logo and legal text before title screen
##
## Displays for a set duration or can be skipped with any input.

signal splash_finished

## Duration to show splash before auto-advancing (seconds)
@export var display_duration: float = 3.0
## Minimum display time before skip is allowed (seconds)
@export var min_display_time: float = 1.0

@onready var logo_label: Label = $CenterContainer/VBoxContainer/LogoLabel
@onready var legal_label: Label = $CenterContainer/VBoxContainer/LegalLabel
@onready var skip_hint: Label = $SkipHint
@onready var timer: Timer = $Timer
@onready var fade_rect: ColorRect = $FadeRect

var _can_skip: bool = false
var _elapsed_time: float = 0.0


func _ready() -> void:
    # Start faded in (black), then fade to transparent
    fade_rect.modulate.a = 1.0
    skip_hint.modulate.a = 0.0
    
    # Set up display timer
    timer.wait_time = display_duration
    timer.one_shot = true
    timer.timeout.connect(_on_timer_timeout)
    timer.start()
    
    # Fade in logo and legal
    var tween := create_tween()
    tween.tween_property(fade_rect, "modulate:a", 0.0, 0.5)
    tween.tween_callback(func(): _enable_skip())


func _enable_skip() -> void:
    await get_tree().create_timer(min_display_time).timeout
    _can_skip = true
    # Show skip hint
    var tween := create_tween()
    tween.tween_property(skip_hint, "modulate:a", 0.6, 0.3)


func _process(delta: float) -> void:
    _elapsed_time += delta


func _input(event: InputEvent) -> void:
    if not _can_skip:
        return
    
    # Skip on any action press or touch
    if event is InputEventScreenTouch and event.pressed:
        _skip()
    elif event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
        _skip()


func _skip() -> void:
    timer.stop()
    _fade_out()


func _on_timer_timeout() -> void:
    _fade_out()


func _fade_out() -> void:
    var tween := create_tween()
    tween.tween_property(fade_rect, "modulate:a", 1.0, 0.5)
    tween.tween_callback(func(): splash_finished.emit())
