extends Control

@onready var item_list_container: VBoxContainer = %ItemListContainer
@onready var empty_label: Label = %EmptyLabel
@onready var close_button: Button = %CloseButton

signal close_requested

var _game_state
var _data_registry

func _ready() -> void:
	_game_state = get_node("/root/GameState")
	_data_registry = get_node("/root/DataRegistry")
	
	if close_button:
		close_button.pressed.connect(_on_close_pressed)
	refresh()

func refresh() -> void:
	# Clear existing
	for child in item_list_container.get_children():
		child.queue_free()
	
	var inventory = _game_state.inventory
	var has_items = false
	
	for item_id in inventory:
		var count = inventory[item_id]
		if count > 0:
			has_items = true
			_add_item_row(item_id, count)
	
	empty_label.visible = not has_items
	item_list_container.visible = has_items

func _add_item_row(item_id: String, count: int) -> void:
	var item_def = _data_registry.get_item(item_id)
	var display_name = item_id
	if item_def and "display_name" in item_def and not item_def.display_name.is_empty():
		display_name = item_def.display_name
		
	var label = Label.new()
	label.text = "%s x%d" % [display_name, count]
	item_list_container.add_child(label)

func _on_close_pressed() -> void:
	close_requested.emit()
