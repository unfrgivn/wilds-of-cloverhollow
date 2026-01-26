extends CanvasLayer
## Dialogue box UI for displaying text and branching choices

@onready var panel: Panel = $Panel
@onready var label: Label = $Panel/Label
@onready var choices_container: VBoxContainer = $Panel/ChoicesContainer

var _showing_choices: bool = false
var _choice_buttons: Array = []
var _selected_choice: int = 0
var _base_font_size: int = 16  # Default font size

func _ready() -> void:
	DialogueManager.register_ui(self)
	hide_dialogue()
	
	# Store base font size and apply current scale
	_base_font_size = label.get_theme_font_size("font_size") if label.has_theme_font_size("font_size") else 16
	_apply_text_scale()
	
	# Listen for text size changes
	SettingsManager.text_size_changed.connect(_on_text_size_changed)
	
	# Create choices container if it doesn't exist
	if not choices_container:
		choices_container = VBoxContainer.new()
		choices_container.name = "ChoicesContainer"
		panel.add_child(choices_container)
		choices_container.position = Vector2(8, 28)
		choices_container.size = Vector2(464, 40)

func _on_text_size_changed(_new_size: int) -> void:
	_apply_text_scale()

func _apply_text_scale() -> void:
	var scale: float = SettingsManager.get_text_size_scale()
	var new_size := int(_base_font_size * scale)
	label.add_theme_font_size_override("font_size", new_size)
	print("[DialogueUI] Text size scaled to: %d (scale: %.1f)" % [new_size, scale])

func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if _showing_choices:
		# Navigate choices with up/down
		if event.is_action_pressed("ui_up"):
			_select_choice(_selected_choice - 1)
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("ui_down"):
			_select_choice(_selected_choice + 1)
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
			_confirm_choice()
			get_viewport().set_input_as_handled()
	else:
		# Dismiss dialogue on interact key or ui_accept
		if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
			DialogueManager.hide_dialogue()
			get_viewport().set_input_as_handled()

func show_text(text: String) -> void:
	_showing_choices = false
	_clear_choices()
	label.text = text
	label.visible = true
	visible = true

func show_choices(prompt: String, choices: Array) -> void:
	_showing_choices = true
	label.text = prompt
	label.visible = true
	visible = true
	
	_clear_choices()
	_selected_choice = 0
	
	for i in range(choices.size()):
		var choice = choices[i]
		var choice_text = choice.get("text", "Option " + str(i + 1))
		
		var button = Button.new()
		button.text = choice_text
		button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		button.flat = true
		button.add_theme_color_override("font_color", Color.WHITE)
		button.add_theme_color_override("font_hover_color", Color.YELLOW)
		button.add_theme_color_override("font_focus_color", Color.YELLOW)
		button.custom_minimum_size = Vector2(460, 20)
		
		# Connect button press
		var choice_index = i
		button.pressed.connect(func(): _on_choice_pressed(choice_index))
		
		choices_container.add_child(button)
		_choice_buttons.append(button)
	
	# Highlight first choice
	_update_choice_highlight()

func _select_choice(index: int) -> void:
	if _choice_buttons.is_empty():
		return
	_selected_choice = clamp(index, 0, _choice_buttons.size() - 1)
	_update_choice_highlight()

func _update_choice_highlight() -> void:
	for i in range(_choice_buttons.size()):
		var button: Button = _choice_buttons[i]
		if i == _selected_choice:
			button.text = "> " + button.text.trim_prefix("> ")
			button.add_theme_color_override("font_color", Color.YELLOW)
		else:
			button.text = button.text.trim_prefix("> ")
			button.add_theme_color_override("font_color", Color.WHITE)

func _confirm_choice() -> void:
	if _choice_buttons.is_empty():
		return
	DialogueManager.select_choice(_selected_choice)

func _on_choice_pressed(choice_index: int) -> void:
	_selected_choice = choice_index
	_confirm_choice()

func _clear_choices() -> void:
	for button in _choice_buttons:
		if is_instance_valid(button):
			button.queue_free()
	_choice_buttons.clear()

func hide_dialogue() -> void:
	visible = false
	label.text = ""
	_showing_choices = false
	_clear_choices()
