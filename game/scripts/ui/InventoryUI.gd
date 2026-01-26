extends CanvasLayer

## InventoryUI - Grid-based item management screen with details and actions

signal inventory_closed
signal item_used(item_id: String)
signal item_discarded(item_id: String)

var _is_active: bool = false
var _selected_index: int = 0
var _items: Array[Dictionary] = []  # [{item_id, count, data}]
var _action_mode: bool = false
var _action_index: int = 0
var _actions: Array[String] = ["Use", "Discard", "Cancel"]

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var grid_container: GridContainer = $Panel/GridContainer
@onready var details_panel: Panel = $Panel/DetailsPanel
@onready var details_name: Label = $Panel/DetailsPanel/ItemName
@onready var details_desc: Label = $Panel/DetailsPanel/ItemDesc
@onready var details_type: Label = $Panel/DetailsPanel/ItemType
@onready var actions_container: VBoxContainer = $Panel/ActionsContainer
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
	add_to_group("inventory_ui")
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS

func _input(event: InputEvent) -> void:
	if not _is_active:
		return
	
	if _action_mode:
		_handle_action_input(event)
	else:
		_handle_grid_input(event)

func _handle_grid_input(event: InputEvent) -> void:
	var columns := 5
	
	if event.is_action_pressed("ui_up"):
		_move_selection(-columns)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_move_selection(columns)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_left"):
		_move_selection(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		_move_selection(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		if _items.size() > 0:
			_open_action_menu()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
		close_inventory()
		get_viewport().set_input_as_handled()

func _handle_action_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_up"):
		_action_index = wrapi(_action_index - 1, 0, _actions.size())
		_update_action_selection()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_action_index = wrapi(_action_index + 1, 0, _actions.size())
		_update_action_selection()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		_execute_action()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel"):
		_close_action_menu()
		get_viewport().set_input_as_handled()

func open_inventory() -> void:
	_is_active = true
	_selected_index = 0
	_action_mode = false
	visible = true
	_refresh_items()
	_update_grid()
	_update_details()
	print("[InventoryUI] Opened")

func close_inventory() -> void:
	_is_active = false
	visible = false
	inventory_closed.emit()
	print("[InventoryUI] Closed")

func _refresh_items() -> void:
	_items.clear()
	var owned := InventoryManager.get_all_items()
	for item_id in owned:
		var count: int = owned[item_id]
		var data: Dictionary = GameData.get_item(item_id)
		if not data.is_empty():
			_items.append({"item_id": item_id, "count": count, "data": data})
	
	# Sort by name for consistent display
	_items.sort_custom(func(a, b): return a["data"].get("name", "") < b["data"].get("name", ""))

func _update_grid() -> void:
	# Clear existing grid items
	for child in grid_container.get_children():
		child.queue_free()
	
	if _items.size() == 0:
		var empty_label := Label.new()
		empty_label.text = "No items"
		empty_label.custom_minimum_size = Vector2(200, 30)
		empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		grid_container.add_child(empty_label)
		return
	
	# Create item buttons
	for i in range(_items.size()):
		var item := _items[i]
		var item_button := Button.new()
		item_button.text = "%s x%d" % [item["data"].get("name", "Unknown"), item["count"]]
		item_button.custom_minimum_size = Vector2(80, 24)
		item_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		item_button.pressed.connect(_on_item_pressed.bind(i))
		grid_container.add_child(item_button)
	
	# Wait a frame then update selection
	await get_tree().process_frame
	_update_selection()

func _move_selection(delta: int) -> void:
	if _items.size() == 0:
		return
	_selected_index = clampi(_selected_index + delta, 0, _items.size() - 1)
	_update_selection()
	_update_details()

func _update_selection() -> void:
	var buttons := grid_container.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _selected_index)
			if i == _selected_index:
				buttons[i].grab_focus()

func _update_details() -> void:
	if _items.size() == 0 or _selected_index >= _items.size():
		details_name.text = ""
		details_desc.text = "No items in inventory"
		details_type.text = ""
		return
	
	var item := _items[_selected_index]
	var data: Dictionary = item["data"]
	details_name.text = data.get("name", "Unknown")
	details_desc.text = data.get("description", "")
	
	var type_str: String = data.get("type", "")
	var effect_str: String = data.get("effect", "")
	if effect_str != "":
		type_str += " (%s)" % effect_str
	details_type.text = type_str.capitalize()

func _on_item_pressed(index: int) -> void:
	_selected_index = index
	_update_selection()
	_update_details()
	_open_action_menu()

func _open_action_menu() -> void:
	_action_mode = true
	_action_index = 0
	actions_container.visible = true
	
	# Clear and populate actions
	for child in actions_container.get_children():
		child.queue_free()
	
	for i in range(_actions.size()):
		var action_button := Button.new()
		action_button.text = _actions[i]
		action_button.custom_minimum_size = Vector2(60, 20)
		action_button.alignment = HORIZONTAL_ALIGNMENT_CENTER
		action_button.pressed.connect(_on_action_pressed.bind(i))
		actions_container.add_child(action_button)
	
	await get_tree().process_frame
	_update_action_selection()

func _close_action_menu() -> void:
	_action_mode = false
	actions_container.visible = false

func _update_action_selection() -> void:
	var buttons := actions_container.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _action_index)
			if i == _action_index:
				buttons[i].grab_focus()

func _on_action_pressed(index: int) -> void:
	_action_index = index
	_execute_action()

func _execute_action() -> void:
	var action := _actions[_action_index]
	
	if _items.size() == 0 or _selected_index >= _items.size():
		_close_action_menu()
		return
	
	var item := _items[_selected_index]
	var item_id: String = item["item_id"]
	
	match action:
		"Use":
			_use_item(item_id)
		"Discard":
			_discard_item(item_id)
		"Cancel":
			pass
	
	_close_action_menu()

func _use_item(item_id: String) -> void:
	var data: Dictionary = GameData.get_item(item_id)
	if data.is_empty():
		print("[InventoryUI] Item not found: %s" % item_id)
		return
	
	var item_type: String = data.get("type", "")
	if item_type != "consumable":
		print("[InventoryUI] Cannot use non-consumable: %s" % item_id)
		return
	
	# For now, just consume the item and print effect
	# Future: actually apply effect to party
	var effect: String = data.get("effect", "")
	var power: int = data.get("power", 0)
	
	InventoryManager.remove_item(item_id, 1)
	item_used.emit(item_id)
	print("[InventoryUI] Used %s: %s (power %d)" % [data.get("name", item_id), effect, power])
	
	_refresh_items()
	_selected_index = clampi(_selected_index, 0, max(_items.size() - 1, 0))
	_update_grid()
	_update_details()

func _discard_item(item_id: String) -> void:
	InventoryManager.remove_item(item_id, 1)
	item_discarded.emit(item_id)
	print("[InventoryUI] Discarded 1x %s" % item_id)
	
	_refresh_items()
	_selected_index = clampi(_selected_index, 0, max(_items.size() - 1, 0))
	_update_grid()
	_update_details()
