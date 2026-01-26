extends CanvasLayer

## ShopUI - Buy interface for shops

signal purchase_requested(item_id: String, price: int)
signal shop_closed

## Item data cache
var _items_data: Dictionary = {}
var _current_items: Array[String] = []
var _selected_index: int = 0

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var gold_label: Label = $Panel/GoldLabel
@onready var items_container: VBoxContainer = $Panel/ItemsContainer
@onready var message_label: Label = $Panel/MessageLabel
@onready var instructions_label: Label = $Panel/InstructionsLabel

func _ready() -> void:
	add_to_group("shop_ui")
	visible = false
	_load_items_data()

func _load_items_data() -> void:
	# Load items from GameData (items is already a Dictionary keyed by id)
	if GameData.items.is_empty():
		GameData.load_all_data()
	_items_data = GameData.items

func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if event.is_action_pressed("ui_cancel"):
		close_shop()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_up"):
		_move_selection(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_move_selection(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		_confirm_purchase()
		get_viewport().set_input_as_handled()

func open_shop(items: Array[String], gold: int) -> void:
	_current_items = items
	_selected_index = 0
	visible = true
	update_gold(gold)
	_populate_items()
	message_label.text = ""
	print("[ShopUI] Opened with %d items" % items.size())

func close_shop() -> void:
	visible = false
	shop_closed.emit()
	print("[ShopUI] Closed")

func update_gold(gold: int) -> void:
	gold_label.text = "Gold: %d" % gold

func show_message(text: String) -> void:
	message_label.text = text

func _populate_items() -> void:
	# Clear existing items
	for child in items_container.get_children():
		child.queue_free()
	
	# Add item buttons
	for i in range(_current_items.size()):
		var item_id = _current_items[i]
		var item_data = _items_data.get(item_id, null)
		if item_data == null:
			continue
		
		var item_button = Button.new()
		item_button.text = "%s - %dG" % [item_data.name, item_data.price]
		item_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		item_button.pressed.connect(_on_item_pressed.bind(i))
		items_container.add_child(item_button)
	
	_update_selection()

func _move_selection(delta: int) -> void:
	if _current_items.is_empty():
		return
	_selected_index = clampi(_selected_index + delta, 0, _current_items.size() - 1)
	_update_selection()

func _update_selection() -> void:
	var buttons = items_container.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _selected_index)
			if i == _selected_index:
				buttons[i].grab_focus()

func _on_item_pressed(index: int) -> void:
	_selected_index = index
	_confirm_purchase()

func _confirm_purchase() -> void:
	if _selected_index < 0 or _selected_index >= _current_items.size():
		return
	
	var item_id = _current_items[_selected_index]
	var item_data = _items_data.get(item_id, null)
	if item_data == null:
		return
	
	var price: int = item_data.price
	purchase_requested.emit(item_id, price)
