extends CanvasLayer
## VictoryScreen - Post-battle rewards display

signal continue_pressed

## Victory data
var total_xp: int = 0
var total_gold: int = 0
var items_gained: Array = []

## UI refs
@onready var xp_label: Label = $Panel/VBox/XPLabel
@onready var gold_label: Label = $Panel/VBox/GoldLabel
@onready var items_container: VBoxContainer = $Panel/VBox/ItemsContainer
@onready var continue_button: Button = $Panel/VBox/ContinueButton

func _ready() -> void:
	visible = false
	if continue_button:
		continue_button.pressed.connect(_on_continue_pressed)

## Show victory screen with rewards data
func show_victory(xp: int, gold: int, items: Array) -> void:
	total_xp = xp
	total_gold = gold
	items_gained = items
	
	_update_ui()
	visible = true
	print("[VictoryScreen] Victory! XP: %d, Gold: %d, Items: %s" % [xp, gold, items])

func _update_ui() -> void:
	if xp_label:
		xp_label.text = "XP Gained: %d" % total_xp
	if gold_label:
		gold_label.text = "Gold: %d" % total_gold
	
	# Clear and populate items
	if items_container:
		for child in items_container.get_children():
			child.queue_free()
		
		if items_gained.is_empty():
			var no_items := Label.new()
			no_items.text = "No items dropped"
			no_items.add_theme_font_size_override("font_size", 8)
			no_items.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			items_container.add_child(no_items)
		else:
			for item_id in items_gained:
				var item_label := Label.new()
				var item_data: Dictionary = GameData.get_item(item_id)
				var item_name: String = item_data.get("name", item_id)
				item_label.text = "+ %s" % item_name
				item_label.add_theme_font_size_override("font_size", 8)
				item_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				items_container.add_child(item_label)

func _on_continue_pressed() -> void:
	visible = false
	continue_pressed.emit()

func _input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
		_on_continue_pressed()
