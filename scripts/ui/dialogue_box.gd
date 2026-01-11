extends CanvasLayer
class_name DialogueBox
## EarthBound-style dialogue box with typewriter effect

signal dialogue_finished

@onready var panel: PanelContainer = $PanelContainer
@onready var speaker_label: Label = $PanelContainer/MarginContainer/VBoxContainer/SpeakerLabel
@onready var dialogue_label: RichTextLabel = $PanelContainer/MarginContainer/VBoxContainer/DialogueLabel
@onready var continue_indicator: Label = $PanelContainer/MarginContainer/VBoxContainer/ContinueIndicator
@onready var interaction_prompt: PanelContainer = $InteractionPrompt
@onready var prompt_label: Label = $InteractionPrompt/Label

var _lines: Array[String] = []
var _current_line_index: int = 0
var _is_typing: bool = false
var _is_active: bool = false

const CHARS_PER_SECOND: float = 30.0

func _ready() -> void:
	panel.visible = false
	interaction_prompt.visible = false
	continue_indicator.visible = false

func _unhandled_input(event: InputEvent) -> void:
	if not _is_active:
		return
	
	if event.is_action_pressed("interact") or event.is_action_pressed("cancel"):
		get_viewport().set_input_as_handled()
		if _is_typing:
			_finish_typing()
		else:
			_advance_dialogue()

func show_dialogue(lines: Array[String], speaker: String = "") -> void:
	_lines = lines
	_current_line_index = 0
	_is_active = true
	
	if speaker.is_empty():
		speaker_label.visible = false
	else:
		speaker_label.visible = true
		speaker_label.text = speaker
	
	panel.visible = true
	interaction_prompt.visible = false
	_display_current_line()

func close_dialogue() -> void:
	_is_active = false
	panel.visible = false
	dialogue_finished.emit()

func show_prompt(prompt_text: String) -> void:
	prompt_label.text = "[Z] " + prompt_text
	interaction_prompt.visible = true

func hide_prompt() -> void:
	interaction_prompt.visible = false

func is_active() -> bool:
	return _is_active

func _display_current_line() -> void:
	if _current_line_index >= _lines.size():
		close_dialogue()
		return
	
	var line := _lines[_current_line_index]
	dialogue_label.text = line
	dialogue_label.visible_ratio = 0.0
	continue_indicator.visible = false
	_is_typing = true
	
	var tween := create_tween()
	var duration := line.length() / CHARS_PER_SECOND
	tween.tween_property(dialogue_label, "visible_ratio", 1.0, duration)
	tween.tween_callback(_on_typing_finished)

func _finish_typing() -> void:
	dialogue_label.visible_ratio = 1.0
	_is_typing = false
	continue_indicator.visible = true

func _on_typing_finished() -> void:
	_is_typing = false
	continue_indicator.visible = true

func _advance_dialogue() -> void:
	_current_line_index += 1
	_display_current_line()
