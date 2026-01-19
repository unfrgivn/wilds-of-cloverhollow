extends CanvasLayer

@onready var safe_area: MarginContainer = $SafeArea
@onready var panel: PanelContainer = $SafeArea/DialoguePanel
@onready var text_label: RichTextLabel = $SafeArea/DialoguePanel/VBoxContainer/DialogueText
@onready var name_label: Label = $SafeArea/DialoguePanel/VBoxContainer/SpeakerName
@onready var next_indicator: Control = $SafeArea/DialoguePanel/NextIndicator
@onready var _dialogue_manager = get_node("/root/DialogueManager")

var typing_speed: float = 0.05
var current_line: DialogueLine
var is_typing: bool = false
var _typing_tween: Tween

func _ready() -> void:
	visible = false
	_update_safe_area()
	get_tree().root.size_changed.connect(_update_safe_area)

func _update_safe_area() -> void:
	var safe_rect = DisplayServer.get_display_safe_area()
	var window_size = DisplayServer.window_get_size()
	
	# Apply margins to the SafeArea container
	safe_area.add_theme_constant_override("margin_left", safe_rect.position.x + 20) # +20 padding
	safe_area.add_theme_constant_override("margin_top", safe_rect.position.y + 20)
	safe_area.add_theme_constant_override("margin_right", window_size.x - (safe_rect.position.x + safe_rect.size.x) + 20)
	safe_area.add_theme_constant_override("margin_bottom", window_size.y - (safe_rect.position.y + safe_rect.size.y) + 20)

func display_line(line: DialogueLine) -> void:
	current_line = line
	name_label.text = line.speaker_name
	name_label.visible = not line.speaker_name.is_empty()
	
	text_label.text = line.text
	text_label.visible_ratio = 0.0
	is_typing = true
	next_indicator.visible = false
	
	if _typing_tween and _typing_tween.is_valid():
		_typing_tween.kill()
	
	var duration = line.text.length() * typing_speed
	_typing_tween = create_tween()
	_typing_tween.tween_property(text_label, "visible_ratio", 1.0, duration)
	_typing_tween.finished.connect(_on_typing_finished)

func _on_typing_finished() -> void:
	is_typing = false
	next_indicator.visible = true

func _input(event: InputEvent) -> void:
	if not visible: return
	
	if event.is_action_pressed("interact") or (event is InputEventScreenTouch and event.pressed):
		get_viewport().set_input_as_handled()
		_handle_advance()

func _handle_advance() -> void:
	if is_typing:
		# Skip typing
		if _typing_tween and _typing_tween.is_valid():
			_typing_tween.kill()
		text_label.visible_ratio = 1.0
		_on_typing_finished()
	else:
		# Next line
		_dialogue_manager.advance()
