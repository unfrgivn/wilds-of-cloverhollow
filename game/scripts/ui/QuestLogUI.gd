extends CanvasLayer

## QuestLogUI - Shows player's active and completed quests
## Opened via pause menu or quest button

signal closed

enum View { ACTIVE, COMPLETED }

@onready var _panel: Panel = $Panel
@onready var _title_label: Label = $Panel/TitleLabel
@onready var _tabs: HBoxContainer = $Panel/TabsContainer
@onready var _active_tab: Button = $Panel/TabsContainer/ActiveTab
@onready var _completed_tab: Button = $Panel/TabsContainer/CompletedTab
@onready var _quests_container: VBoxContainer = $Panel/QuestsContainer
@onready var _details_panel: Panel = $Panel/DetailsPanel
@onready var _quest_name_label: Label = $Panel/DetailsPanel/QuestName
@onready var _quest_desc_label: Label = $Panel/DetailsPanel/QuestDescription
@onready var _objectives_container: VBoxContainer = $Panel/DetailsPanel/ObjectivesContainer
@onready var _close_button: Button = $Panel/CloseButton

var _current_view: View = View.ACTIVE
var _selected_quest_index: int = 0
var _displayed_quests: Array[Dictionary] = []


func _ready() -> void:
	visible = false
	_active_tab.pressed.connect(_on_active_tab_pressed)
	_completed_tab.pressed.connect(_on_completed_tab_pressed)
	_close_button.pressed.connect(close_log)
	
	_update_tab_visuals()


func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if event.is_action_pressed("ui_cancel"):
		close_log()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_up"):
		_select_previous()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_select_next()
		get_viewport().set_input_as_handled()


func open_log() -> void:
	visible = true
	_current_view = View.ACTIVE
	_selected_quest_index = 0
	_update_tab_visuals()
	_refresh_quest_list()
	
	# Pause player
	var player := get_tree().get_first_node_in_group("player")
	if player and player.has_method("set_movement_enabled"):
		player.set_movement_enabled(false)


func close_log() -> void:
	visible = false
	closed.emit()
	
	# Resume player
	var player := get_tree().get_first_node_in_group("player")
	if player and player.has_method("set_movement_enabled"):
		player.set_movement_enabled(true)


func _on_active_tab_pressed() -> void:
	_current_view = View.ACTIVE
	_selected_quest_index = 0
	_update_tab_visuals()
	_refresh_quest_list()


func _on_completed_tab_pressed() -> void:
	_current_view = View.COMPLETED
	_selected_quest_index = 0
	_update_tab_visuals()
	_refresh_quest_list()


func _update_tab_visuals() -> void:
	_active_tab.disabled = _current_view == View.ACTIVE
	_completed_tab.disabled = _current_view == View.COMPLETED


func _refresh_quest_list() -> void:
	# Clear existing
	for child in _quests_container.get_children():
		child.queue_free()
	
	# Get quests based on view
	_displayed_quests.clear()
	
	if _current_view == View.ACTIVE:
		_displayed_quests = QuestManager.get_active_quests()
		_title_label.text = "Quest Log - Active"
	else:
		# Get completed quest data
		var completed_ids := QuestManager.get_completed_quest_ids()
		for quest_id in completed_ids:
			var quest_data := GameData.get_quest(quest_id)
			if not quest_data.is_empty():
				_displayed_quests.append(quest_data)
		_title_label.text = "Quest Log - Completed"
	
	# Create list items
	for i in range(_displayed_quests.size()):
		var quest: Dictionary = _displayed_quests[i]
		var item := Button.new()
		item.text = quest.get("name", "Unknown Quest")
		item.alignment = HORIZONTAL_ALIGNMENT_LEFT
		item.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		item.pressed.connect(_on_quest_item_pressed.bind(i))
		_quests_container.add_child(item)
	
	# Show empty message if no quests
	if _displayed_quests.is_empty():
		var empty_label := Label.new()
		if _current_view == View.ACTIVE:
			empty_label.text = "No active quests."
		else:
			empty_label.text = "No completed quests."
		empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_quests_container.add_child(empty_label)
	
	# Select first quest
	_selected_quest_index = 0
	_update_selection()
	_update_details()


func _on_quest_item_pressed(index: int) -> void:
	_selected_quest_index = index
	_update_selection()
	_update_details()


func _select_previous() -> void:
	if _displayed_quests.is_empty():
		return
	_selected_quest_index = max(0, _selected_quest_index - 1)
	_update_selection()
	_update_details()


func _select_next() -> void:
	if _displayed_quests.is_empty():
		return
	_selected_quest_index = min(_displayed_quests.size() - 1, _selected_quest_index + 1)
	_update_selection()
	_update_details()


func _update_selection() -> void:
	var buttons := _quests_container.get_children()
	for i in range(buttons.size()):
		var btn := buttons[i]
		if btn is Button:
			btn.button_pressed = (i == _selected_quest_index)


func _update_details() -> void:
	# Clear objectives
	for child in _objectives_container.get_children():
		child.queue_free()
	
	if _displayed_quests.is_empty() or _selected_quest_index >= _displayed_quests.size():
		_quest_name_label.text = ""
		_quest_desc_label.text = ""
		_details_panel.visible = false
		return
	
	_details_panel.visible = true
	var quest: Dictionary = _displayed_quests[_selected_quest_index]
	
	_quest_name_label.text = quest.get("name", "Unknown Quest")
	_quest_desc_label.text = quest.get("description", "")
	
	# Show objectives
	var objectives: Array = quest.get("objectives", [])
	var objective_status: Array = quest.get("objective_status", [])
	
	for i in range(objectives.size()):
		var obj_label := Label.new()
		var completed := false
		if i < objective_status.size():
			completed = objective_status[i]
		
		var prefix := "[x] " if completed or _current_view == View.COMPLETED else "[ ] "
		obj_label.text = prefix + objectives[i]
		obj_label.add_theme_font_size_override("font_size", 10)
		_objectives_container.add_child(obj_label)
	
	# Show reward if completed view
	if _current_view == View.COMPLETED:
		var reward_gold: int = quest.get("reward_gold", 0)
		if reward_gold > 0:
			var reward_label := Label.new()
			reward_label.text = "Reward: %d gold" % reward_gold
			reward_label.add_theme_font_size_override("font_size", 10)
			reward_label.add_theme_color_override("font_color", Color.GOLD)
			_objectives_container.add_child(reward_label)
