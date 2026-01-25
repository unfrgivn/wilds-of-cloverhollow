extends Node
## Global dialogue manager - handles showing/hiding dialogue UI

signal dialogue_shown(text: String)
signal dialogue_hidden

var _dialogue_ui: Node = null
var _is_showing: bool = false

func _ready() -> void:
    # DialogueUI will register itself when it's ready
    pass

## Register the dialogue UI instance (called by DialogueUI on _ready)
func register_ui(ui: Node) -> void:
    _dialogue_ui = ui

## Show dialogue text
func show_dialogue(text: String) -> void:
    if _dialogue_ui == null:
        push_warning("DialogueManager: No dialogue UI registered")
        return
    _is_showing = true
    _dialogue_ui.show_text(text)
    dialogue_shown.emit(text)

## Hide dialogue
func hide_dialogue() -> void:
    if _dialogue_ui == null:
        return
    _is_showing = false
    _dialogue_ui.hide_dialogue()
    dialogue_hidden.emit()

## Check if dialogue is currently showing
func is_showing() -> bool:
    return _is_showing
