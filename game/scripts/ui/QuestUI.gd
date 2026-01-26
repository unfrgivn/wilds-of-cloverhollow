extends CanvasLayer

## QuestUI - Displays available quests from the bulletin board

signal quest_accepted(quest_id: String)
signal quest_declined(quest_id: String)
signal ui_closed

## Quest data cache
var _quests: Array = []
var _selected_index: int = 0
var _viewing_details: bool = false

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var quests_container: VBoxContainer = $Panel/QuestsContainer
@onready var details_panel: Panel = $Panel/DetailsPanel
@onready var quest_name_label: Label = $Panel/DetailsPanel/QuestNameLabel
@onready var description_label: Label = $Panel/DetailsPanel/DescriptionLabel
@onready var reward_label: Label = $Panel/DetailsPanel/RewardLabel
@onready var objectives_label: Label = $Panel/DetailsPanel/ObjectivesLabel
@onready var accept_button: Button = $Panel/DetailsPanel/AcceptButton
@onready var decline_button: Button = $Panel/DetailsPanel/DeclineButton
@onready var instructions_label: Label = $Panel/InstructionsLabel
@onready var no_quests_label: Label = $Panel/NoQuestsLabel

func _ready() -> void:
	add_to_group("quest_ui")
	visible = false
	details_panel.visible = false
	no_quests_label.visible = false

func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if _viewing_details:
		_handle_details_input(event)
	else:
		_handle_list_input(event)

func _handle_list_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		close_ui()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_up"):
		_move_selection(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		_move_selection(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		_show_quest_details()
		get_viewport().set_input_as_handled()

func _handle_details_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		_hide_quest_details()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_left"):
		accept_button.grab_focus()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		decline_button.grab_focus()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		var focused = get_viewport().gui_get_focus_owner()
		if focused == accept_button:
			_on_accept_pressed()
		elif focused == decline_button:
			_on_decline_pressed()
		get_viewport().set_input_as_handled()

func open_quest_board(quests: Array) -> void:
	_quests = quests
	_selected_index = 0
	_viewing_details = false
	visible = true
	details_panel.visible = false
	
	if _quests.is_empty():
		no_quests_label.visible = true
		quests_container.visible = false
		instructions_label.text = "Press Cancel to close"
	else:
		no_quests_label.visible = false
		quests_container.visible = true
		_populate_quests()
		instructions_label.text = "Select quest, Cancel to close"
	
	print("[QuestUI] Opened with %d quests" % quests.size())

func close_ui() -> void:
	visible = false
	_viewing_details = false
	ui_closed.emit()
	print("[QuestUI] Closed")

func _populate_quests() -> void:
	# Clear existing items
	for child in quests_container.get_children():
		child.queue_free()
	
	# Add quest buttons
	for i in range(_quests.size()):
		var quest = _quests[i]
		var quest_button = Button.new()
		quest_button.text = quest.get("name", "Unknown Quest")
		quest_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		quest_button.pressed.connect(_on_quest_pressed.bind(i))
		quests_container.add_child(quest_button)
	
	# Wait a frame for buttons to be added then update selection
	await get_tree().process_frame
	_update_selection()

func _move_selection(delta: int) -> void:
	if _quests.is_empty():
		return
	_selected_index = clampi(_selected_index + delta, 0, _quests.size() - 1)
	_update_selection()

func _update_selection() -> void:
	var buttons = quests_container.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _selected_index)
			if i == _selected_index:
				buttons[i].grab_focus()

func _on_quest_pressed(index: int) -> void:
	_selected_index = index
	_show_quest_details()

func _show_quest_details() -> void:
	if _selected_index < 0 or _selected_index >= _quests.size():
		return
	
	var quest = _quests[_selected_index]
	_viewing_details = true
	details_panel.visible = true
	
	quest_name_label.text = quest.get("name", "Unknown Quest")
	description_label.text = quest.get("description", "No description.")
	
	# Show reward
	var reward_text = "Reward: "
	var reward_gold: int = quest.get("reward_gold", 0)
	if reward_gold > 0:
		reward_text += "%d Gold" % reward_gold
	var reward_items: Array = quest.get("reward_items", [])
	if not reward_items.is_empty():
		if reward_gold > 0:
			reward_text += " + "
		reward_text += ", ".join(reward_items)
	if reward_gold == 0 and reward_items.is_empty():
		reward_text += "None"
	reward_label.text = reward_text
	
	# Show objectives
	var objectives: Array = quest.get("objectives", [])
	if objectives.is_empty():
		objectives_label.text = "Objectives: Complete the quest"
	else:
		var obj_text = "Objectives:\n"
		for obj in objectives:
			obj_text += "- %s\n" % obj
		objectives_label.text = obj_text.strip_edges()
	
	accept_button.grab_focus()
	print("[QuestUI] Showing details for: %s" % quest.get("id", "unknown"))

func _hide_quest_details() -> void:
	_viewing_details = false
	details_panel.visible = false
	_update_selection()

func _on_accept_pressed() -> void:
	if _selected_index < 0 or _selected_index >= _quests.size():
		return
	
	var quest = _quests[_selected_index]
	var quest_id = quest.get("id", "")
	
	# Set the "accepted" story flag for this quest
	InventoryManager.set_story_flag("quest_accepted_" + quest_id, true)
	
	quest_accepted.emit(quest_id)
	print("[QuestUI] Quest accepted: %s" % quest_id)
	
	# Close details and refresh list
	_hide_quest_details()
	# Remove accepted quest from list
	_quests.remove_at(_selected_index)
	if _selected_index >= _quests.size():
		_selected_index = maxi(0, _quests.size() - 1)
	
	if _quests.is_empty():
		no_quests_label.visible = true
		quests_container.visible = false
	else:
		_populate_quests()

func _on_decline_pressed() -> void:
	if _selected_index < 0 or _selected_index >= _quests.size():
		return
	
	var quest = _quests[_selected_index]
	var quest_id = quest.get("id", "")
	
	quest_declined.emit(quest_id)
	print("[QuestUI] Quest declined: %s" % quest_id)
	
	_hide_quest_details()
