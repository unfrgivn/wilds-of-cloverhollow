extends CanvasLayer

## PauseMenuUI - In-game pause menu with Resume, Items, Save, Quit options

signal menu_closed
signal resume_pressed
signal items_pressed
signal save_pressed
signal quit_pressed

var _selected_index: int = 0
var _menu_options: Array[String] = ["Resume", "Items", "Save", "Quit"]
var _is_active: bool = false

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var options_container: VBoxContainer = $Panel/OptionsContainer
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
	add_to_group("pause_menu")
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS

func _input(event: InputEvent) -> void:
	if not _is_active:
		return
	
	if event.is_action_pressed("ui_up"):
		_move_selection(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_move_selection(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		_select_option()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
		_on_resume()
		get_viewport().set_input_as_handled()

func open_menu() -> void:
	_is_active = true
	_selected_index = 0
	visible = true
	_populate_options()
	print("[PauseMenuUI] Opened")

func close_menu() -> void:
	_is_active = false
	visible = false
	menu_closed.emit()
	print("[PauseMenuUI] Closed")

func _populate_options() -> void:
	# Clear existing buttons
	for child in options_container.get_children():
		child.queue_free()
	
	# Create buttons for each option
	for i in range(_menu_options.size()):
		var option_button = Button.new()
		option_button.text = _menu_options[i]
		option_button.alignment = HORIZONTAL_ALIGNMENT_CENTER
		option_button.custom_minimum_size = Vector2(120, 24)
		option_button.pressed.connect(_on_option_pressed.bind(i))
		options_container.add_child(option_button)
	
	# Wait a frame then update selection
	await get_tree().process_frame
	_update_selection()

func _move_selection(delta: int) -> void:
	_selected_index = wrapi(_selected_index + delta, 0, _menu_options.size())
	_update_selection()

func _update_selection() -> void:
	var buttons = options_container.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _selected_index)
			if i == _selected_index:
				buttons[i].grab_focus()

func _on_option_pressed(index: int) -> void:
	_selected_index = index
	_select_option()

func _select_option() -> void:
	var option = _menu_options[_selected_index]
	print("[PauseMenuUI] Selected: %s" % option)
	
	match option:
		"Resume":
			_on_resume()
		"Items":
			_on_items()
		"Save":
			_on_save()
		"Quit":
			_on_quit()

func _on_resume() -> void:
	resume_pressed.emit()
	close_menu()
	PauseManager.toggle_pause()

func _on_items() -> void:
	items_pressed.emit()
	print("[PauseMenuUI] Items selected (placeholder - inventory UI not yet available)")

func _on_save() -> void:
	save_pressed.emit()
	SaveManager.save_game()
	print("[PauseMenuUI] Game saved!")
	# Show save confirmation briefly
	title_label.text = "Game Saved!"
	await get_tree().create_timer(1.0).timeout
	if _is_active:
		title_label.text = "PAUSED"

func _on_quit() -> void:
	quit_pressed.emit()
	# Unpause before quitting
	PauseManager.unpause_game()
	# Return to title screen
	SceneRouter.change_scene("res://game/scenes/Main.tscn", "")
	print("[PauseMenuUI] Returning to title screen")
