extends CanvasLayer
## Pet selection screen shown at game start

signal pet_selected(pet_id: String)

@onready var title_label: Label = $Panel/TitleLabel
@onready var pet_container: HBoxContainer = $Panel/PetContainer
@onready var description_label: Label = $Panel/DescriptionLabel
@onready var confirm_button: Button = $Panel/ConfirmButton
@onready var fade_rect: ColorRect = $FadeRect

var pet_buttons: Array[Button] = []
var selected_index: int = 0
var pet_options: Array = []

func _ready() -> void:
	visible = false
	fade_rect.modulate.a = 0.0
	confirm_button.pressed.connect(_on_confirm_pressed)

func show_selection() -> void:
	visible = true
	pet_options = PartyManager.get_pet_options()
	_create_pet_buttons()
	_select_pet(0)
	
	# Fade in
	var tween: Tween = create_tween()
	tween.tween_property(fade_rect, "modulate:a", 1.0, 0.3)

func _create_pet_buttons() -> void:
	# Clear existing buttons
	for child in pet_container.get_children():
		child.queue_free()
	pet_buttons.clear()
	
	# Create button for each pet option
	for i in range(pet_options.size()):
		var pet: Dictionary = pet_options[i]
		var btn: Button = Button.new()
		btn.text = pet.get("name", "Pet")
		btn.custom_minimum_size = Vector2(100, 60)
		btn.focus_mode = Control.FOCUS_ALL
		var idx: int = i
		btn.pressed.connect(func() -> void: _select_pet(idx))
		btn.focus_entered.connect(func() -> void: _select_pet(idx))
		pet_container.add_child(btn)
		pet_buttons.append(btn)

func _select_pet(index: int) -> void:
	if index < 0 or index >= pet_options.size():
		return
	
	selected_index = index
	var pet: Dictionary = pet_options[index]
	
	# Update description
	var desc_text: String = "%s\n%s\n\nHP: %d  MP: %d\nATK: %d  DEF: %d  SPD: %d" % [
		pet.get("name", ""),
		pet.get("description", ""),
		pet.get("max_hp", 0),
		pet.get("max_mp", 0),
		pet.get("attack", 0),
		pet.get("defense", 0),
		pet.get("speed", 0)
	]
	description_label.text = desc_text
	
	# Highlight selected button
	for i in range(pet_buttons.size()):
		if i == index:
			pet_buttons[i].grab_focus()

func _on_confirm_pressed() -> void:
	if selected_index < 0 or selected_index >= pet_options.size():
		return
	
	var pet: Dictionary = pet_options[selected_index]
	var pet_id: String = pet.get("id", "")
	
	# Set the active pet
	PartyManager.set_active_pet(pet_id)
	
	# Fade out and emit signal
	var tween: Tween = create_tween()
	tween.tween_property(fade_rect, "modulate:a", 0.0, 0.3)
	tween.tween_callback(func() -> void:
		visible = false
		pet_selected.emit(pet_id)
	)

func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if event.is_action_pressed("ui_left"):
		_select_pet(max(0, selected_index - 1))
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		_select_pet(min(pet_options.size() - 1, selected_index + 1))
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
		_on_confirm_pressed()
		get_viewport().set_input_as_handled()
