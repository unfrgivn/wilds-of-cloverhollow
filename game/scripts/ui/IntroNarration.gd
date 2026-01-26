extends CanvasLayer
## IntroNarration - Intro text crawl/narration sequence

signal narration_finished

@onready var text_label: RichTextLabel = $Panel/TextLabel
@onready var continue_label: Label = $Panel/ContinueLabel
@onready var fade_rect: ColorRect = $FadeRect

var narration_lines: Array[String] = [
    "In the peaceful town of Cloverhollow, life was simple and sweet.",
    "Kids went to school, neighbors waved hello, and the biggest worry was homework.",
    "But lately, strange things have been happening...",
    "Animals acting weird. Shadows in the forest. Whispers of trouble.",
    "Nobody knows what's causing it. But someone has to find out.",
    "And that someone... might just be you."
]

var current_line: int = 0
var is_typing: bool = false
var char_index: int = 0
var type_speed: float = 0.03
var type_timer: float = 0.0


func _ready() -> void:
    visible = true
    fade_rect.color = Color(0, 0, 0, 1)
    text_label.text = ""
    continue_label.visible = false
    _fade_in()


func _fade_in() -> void:
    var tween := create_tween()
    tween.tween_property(fade_rect, "color:a", 0.0, 1.0)
    tween.tween_callback(_start_narration)


func _start_narration() -> void:
    current_line = 0
    _show_line()


func _show_line() -> void:
    if current_line >= narration_lines.size():
        _finish_narration()
        return
    
    text_label.text = ""
    char_index = 0
    is_typing = true
    continue_label.visible = false


func _process(delta: float) -> void:
    if not is_typing:
        return
    
    type_timer += delta
    if type_timer >= type_speed:
        type_timer = 0.0
        var full_text := narration_lines[current_line]
        if char_index < full_text.length():
            char_index += 1
            text_label.text = full_text.substr(0, char_index)
        else:
            is_typing = false
            continue_label.visible = true


func _input(event: InputEvent) -> void:
    if not visible:
        return
    
    if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
        if is_typing:
            # Skip to full text
            text_label.text = narration_lines[current_line]
            is_typing = false
            continue_label.visible = true
        else:
            # Advance to next line
            current_line += 1
            _show_line()
        get_viewport().set_input_as_handled()


func _finish_narration() -> void:
    var tween := create_tween()
    tween.tween_property(fade_rect, "color:a", 1.0, 1.0)
    tween.tween_callback(_emit_finished)


func _emit_finished() -> void:
    narration_finished.emit()
