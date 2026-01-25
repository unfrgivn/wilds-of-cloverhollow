extends CanvasLayer
## Simple dialogue box UI for displaying text

@onready var panel: Panel = $Panel
@onready var label: Label = $Panel/Label

func _ready() -> void:
    DialogueManager.register_ui(self)
    hide_dialogue()

func _input(event: InputEvent) -> void:
    if not visible:
        return
    # Dismiss dialogue on interact key or ui_accept
    if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
        DialogueManager.hide_dialogue()
        get_viewport().set_input_as_handled()

func show_text(text: String) -> void:
    label.text = text
    visible = true

func hide_dialogue() -> void:
    visible = false
    label.text = ""
