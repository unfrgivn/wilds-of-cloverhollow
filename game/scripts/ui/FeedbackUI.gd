extends CanvasLayer

## FeedbackUI - In-app feedback form with text input and submit

signal feedback_closed

var _is_active: bool = false
var _selected_category: int = 0
var _categories: Array[String] = ["General", "Bug", "Suggestion", "Other"]

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var category_label: Label = $Panel/CategoryLabel
@onready var category_button: Button = $Panel/CategoryButton
@onready var message_label: Label = $Panel/MessageLabel
@onready var message_input: TextEdit = $Panel/MessageInput
@onready var email_label: Label = $Panel/EmailLabel
@onready var email_input: LineEdit = $Panel/EmailInput
@onready var submit_button: Button = $Panel/SubmitButton
@onready var cancel_button: Button = $Panel/CancelButton
@onready var status_label: Label = $Panel/StatusLabel
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS
	
	# Register with manager
	FeedbackManager.register_ui(self)
	
	# Connect buttons
	submit_button.pressed.connect(_on_submit)
	cancel_button.pressed.connect(_on_cancel)
	category_button.pressed.connect(_cycle_category)
	
	_update_category_display()
	print("[FeedbackUI] Initialized")

func _input(event: InputEvent) -> void:
	if not _is_active:
		return
	
	if event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
		if InputDebouncer.try_act("feedback_cancel"):
			_on_cancel()
		get_viewport().set_input_as_handled()

func show_feedback() -> void:
	_is_active = true
	visible = true
	_clear_form()
	message_input.grab_focus()
	print("[FeedbackUI] Opened")

func hide_feedback() -> void:
	_is_active = false
	visible = false
	feedback_closed.emit()
	print("[FeedbackUI] Closed")

func _clear_form() -> void:
	message_input.text = ""
	email_input.text = ""
	_selected_category = 0
	_update_category_display()
	status_label.text = ""

func _cycle_category() -> void:
	_selected_category = (_selected_category + 1) % _categories.size()
	_update_category_display()
	SFXManager.play_menu_move()

func _update_category_display() -> void:
	category_button.text = _categories[_selected_category]

func _on_submit() -> void:
	var message := message_input.text.strip_edges()
	
	if message.is_empty():
		status_label.text = "Please enter a message"
		status_label.modulate = Color.RED
		SFXManager.play_menu_cancel()
		return
	
	var category := _categories[_selected_category].to_lower()
	var email := email_input.text.strip_edges()
	
	FeedbackManager.submit_feedback(message, category, email)
	
	status_label.text = "Thank you for your feedback!"
	status_label.modulate = Color.GREEN
	SFXManager.play_menu_select()
	
	# Auto-close after brief delay
	await get_tree().create_timer(1.5).timeout
	hide_feedback()
	PauseManager.unpause_game()

func _on_cancel() -> void:
	hide_feedback()
	SFXManager.play_menu_cancel()
	# Return to pause menu
	PauseManager.show_pause_menu()
