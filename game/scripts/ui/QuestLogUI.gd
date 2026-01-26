extends CanvasLayer

## QuestLogUI - Quest tracking interface with active/completed tabs

signal quest_log_closed

enum TabMode { ACTIVE, COMPLETED }

var _is_active: bool = false
var _current_tab: TabMode = TabMode.ACTIVE
var _selected_quest_index: int = 0
var _active_quests: Array[Dictionary] = []
var _completed_quest_ids: Array[String] = []

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var tab_container: HBoxContainer = $Panel/TabContainer
@onready var active_tab: Button = $Panel/TabContainer/ActiveTab
@onready var completed_tab: Button = $Panel/TabContainer/CompletedTab
@onready var quest_list: VBoxContainer = $Panel/QuestList
@onready var details_panel: Panel = $Panel/DetailsPanel
@onready var quest_name: Label = $Panel/DetailsPanel/QuestName
@onready var quest_desc: Label = $Panel/DetailsPanel/QuestDesc
@onready var objectives_label: Label = $Panel/DetailsPanel/ObjectivesLabel
@onready var reward_label: Label = $Panel/DetailsPanel/RewardLabel
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
	add_to_group("quest_log_ui")
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS
	
	active_tab.pressed.connect(_on_active_tab_pressed)
	completed_tab.pressed.connect(_on_completed_tab_pressed)

func _input(event: InputEvent) -> void:
	if not _is_active:
		return
	
	if event.is_action_pressed("ui_up"):
		_move_selection(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_move_selection(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_left"):
		_switch_tab(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		_switch_tab(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
		close_quest_log()
		get_viewport().set_input_as_handled()

func open_quest_log() -> void:
	_is_active = true
	_current_tab = TabMode.ACTIVE
	_selected_quest_index = 0
	visible = true
	_refresh_data()
	_update_tabs()
	_update_quest_list()
	_update_details()
	print("[QuestLogUI] Opened")

func close_quest_log() -> void:
	_is_active = false
	visible = false
	quest_log_closed.emit()
	print("[QuestLogUI] Closed")

func _refresh_data() -> void:
	_active_quests = QuestManager.get_active_quests()
	_completed_quest_ids = QuestManager.get_completed_quest_ids()

func _switch_tab(direction: int) -> void:
	if direction < 0:
		_current_tab = TabMode.ACTIVE
	else:
		_current_tab = TabMode.COMPLETED
	_selected_quest_index = 0
	_update_tabs()
	_update_quest_list()
	_update_details()

func _on_active_tab_pressed() -> void:
	_current_tab = TabMode.ACTIVE
	_selected_quest_index = 0
	_update_tabs()
	_update_quest_list()
	_update_details()

func _on_completed_tab_pressed() -> void:
	_current_tab = TabMode.COMPLETED
	_selected_quest_index = 0
	_update_tabs()
	_update_quest_list()
	_update_details()

func _update_tabs() -> void:
	active_tab.flat = (_current_tab != TabMode.ACTIVE)
	completed_tab.flat = (_current_tab != TabMode.COMPLETED)
	
	if _current_tab == TabMode.ACTIVE:
		active_tab.grab_focus()
	else:
		completed_tab.grab_focus()

func _update_quest_list() -> void:
	# Clear existing
	for child in quest_list.get_children():
		child.queue_free()
	
	var quests_to_show: Array = []
	
	if _current_tab == TabMode.ACTIVE:
		quests_to_show = _active_quests
	else:
		# Build completed quest list from IDs
		for quest_id in _completed_quest_ids:
			var quest_data: Dictionary = GameData.get_quest(quest_id)
			if not quest_data.is_empty():
				quests_to_show.append(quest_data)
	
	if quests_to_show.size() == 0:
		var empty_label := Label.new()
		empty_label.text = "No quests" if _current_tab == TabMode.ACTIVE else "No completed quests"
		empty_label.custom_minimum_size = Vector2(150, 24)
		empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		quest_list.add_child(empty_label)
		return
	
	# Create quest buttons
	for i in range(quests_to_show.size()):
		var quest: Dictionary = quests_to_show[i]
		var quest_button := Button.new()
		quest_button.text = quest.get("name", "Unknown Quest")
		quest_button.custom_minimum_size = Vector2(150, 20)
		quest_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		quest_button.pressed.connect(_on_quest_pressed.bind(i))
		quest_list.add_child(quest_button)
	
	# Wait a frame then update selection
	await get_tree().process_frame
	_update_selection()

func _move_selection(delta: int) -> void:
	var count: int = _get_quest_count()
	if count == 0:
		return
	_selected_quest_index = wrapi(_selected_quest_index + delta, 0, count)
	_update_selection()
	_update_details()

func _get_quest_count() -> int:
	if _current_tab == TabMode.ACTIVE:
		return _active_quests.size()
	else:
		return _completed_quest_ids.size()

func _update_selection() -> void:
	var buttons := quest_list.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _selected_quest_index)
			if i == _selected_quest_index:
				buttons[i].grab_focus()

func _on_quest_pressed(index: int) -> void:
	_selected_quest_index = index
	_update_selection()
	_update_details()

func _update_details() -> void:
	var quest_data: Dictionary = _get_selected_quest_data()
	
	if quest_data.is_empty():
		quest_name.text = ""
		quest_desc.text = "Select a quest to view details"
		objectives_label.text = ""
		reward_label.text = ""
		return
	
	quest_name.text = quest_data.get("name", "Unknown Quest")
	quest_desc.text = quest_data.get("description", "")
	
	# Objectives
	var objectives: Array = quest_data.get("objectives", [])
	var objective_status: Array = quest_data.get("objective_status", [])
	var obj_lines: PackedStringArray = []
	
	for i in range(objectives.size()):
		var obj: Dictionary = objectives[i] if objectives[i] is Dictionary else {"description": str(objectives[i])}
		var desc: String = obj.get("description", "Objective %d" % (i + 1))
		var is_complete: bool = false
		if i < objective_status.size():
			is_complete = objective_status[i]
		
		var checkbox: String = "[x]" if is_complete else "[ ]"
		obj_lines.append("%s %s" % [checkbox, desc])
	
	if obj_lines.size() > 0:
		objectives_label.text = "\n".join(obj_lines)
	else:
		objectives_label.text = ""
	
	# Rewards
	var reward_gold: int = quest_data.get("reward_gold", 0)
	var reward_items: Array = quest_data.get("reward_items", [])
	var reward_parts: PackedStringArray = []
	
	if reward_gold > 0:
		reward_parts.append("%d gold" % reward_gold)
	for item_id in reward_items:
		var item_data: Dictionary = GameData.get_item(item_id)
		if not item_data.is_empty():
			reward_parts.append(item_data.get("name", item_id))
		else:
			reward_parts.append(item_id)
	
	if reward_parts.size() > 0:
		reward_label.text = "Reward: " + ", ".join(reward_parts)
	else:
		reward_label.text = ""

func _get_selected_quest_data() -> Dictionary:
	if _current_tab == TabMode.ACTIVE:
		if _selected_quest_index >= 0 and _selected_quest_index < _active_quests.size():
			return _active_quests[_selected_quest_index]
	else:
		if _selected_quest_index >= 0 and _selected_quest_index < _completed_quest_ids.size():
			var quest_id: String = _completed_quest_ids[_selected_quest_index]
			return GameData.get_quest(quest_id)
	return {}
