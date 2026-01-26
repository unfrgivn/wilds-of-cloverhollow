extends CanvasLayer

## PartyStatusUI - Party member stats screen with HP/MP bars, stats, and equipment

signal party_status_closed

var _is_active: bool = false
var _selected_member_index: int = 0
var _party_members: Array[String] = []  # Member IDs

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var members_container: VBoxContainer = $Panel/MembersContainer
@onready var details_panel: Panel = $Panel/DetailsPanel
@onready var member_name: Label = $Panel/DetailsPanel/MemberName
@onready var hp_bar: ProgressBar = $Panel/DetailsPanel/HPBar
@onready var mp_bar: ProgressBar = $Panel/DetailsPanel/MPBar
@onready var stats_label: Label = $Panel/DetailsPanel/StatsLabel
@onready var equipment_label: Label = $Panel/DetailsPanel/EquipmentLabel
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
	add_to_group("party_status_ui")
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
	elif event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
		close_party_status()
		get_viewport().set_input_as_handled()

func open_party_status() -> void:
	_is_active = true
	_selected_member_index = 0
	visible = true
	_refresh_party()
	_update_member_list()
	_update_details()
	print("[PartyStatusUI] Opened")

func close_party_status() -> void:
	_is_active = false
	visible = false
	party_status_closed.emit()
	print("[PartyStatusUI] Closed")

func _refresh_party() -> void:
	_party_members.clear()
	var all_state: Dictionary = PartyManager.get_all_state()
	for member_id in all_state:
		_party_members.append(member_id)
	# Sort by order (fae first, then others)
	_party_members.sort_custom(func(a, b):
		var order := {"fae": 0, "sue": 1, "jordan": 2, "maddie": 3}
		return order.get(a, 99) < order.get(b, 99)
	)

func _update_member_list() -> void:
	# Clear existing
	for child in members_container.get_children():
		child.queue_free()
	
	# Create member buttons
	for i in range(_party_members.size()):
		var member_id := _party_members[i]
		var state: Dictionary = PartyManager.get_member_state(member_id)
		
		var member_button := Button.new()
		member_button.text = state.get("name", member_id)
		member_button.custom_minimum_size = Vector2(100, 24)
		member_button.alignment = HORIZONTAL_ALIGNMENT_LEFT
		member_button.pressed.connect(_on_member_pressed.bind(i))
		members_container.add_child(member_button)
	
	# Wait a frame then update selection
	await get_tree().process_frame
	_update_selection()

func _move_selection(delta: int) -> void:
	if _party_members.size() == 0:
		return
	_selected_member_index = wrapi(_selected_member_index + delta, 0, _party_members.size())
	_update_selection()
	_update_details()

func _update_selection() -> void:
	var buttons := members_container.get_children()
	for i in range(buttons.size()):
		if buttons[i] is Button:
			buttons[i].flat = (i != _selected_member_index)
			if i == _selected_member_index:
				buttons[i].grab_focus()

func _on_member_pressed(index: int) -> void:
	_selected_member_index = index
	_update_selection()
	_update_details()

func _update_details() -> void:
	if _party_members.size() == 0 or _selected_member_index >= _party_members.size():
		member_name.text = ""
		hp_bar.value = 0
		mp_bar.value = 0
		stats_label.text = ""
		equipment_label.text = ""
		return
	
	var member_id := _party_members[_selected_member_index]
	var state: Dictionary = PartyManager.get_member_state(member_id)
	
	# Name and level
	var name_str: String = state.get("name", member_id)
	var level: int = state.get("level", 1)
	member_name.text = "%s (Lv. %d)" % [name_str, level]
	
	# HP bar
	var current_hp: int = state.get("current_hp", state.get("max_hp", 1))
	var max_hp: int = state.get("max_hp", 1)
	hp_bar.max_value = max_hp
	hp_bar.value = current_hp
	
	# MP bar
	var current_mp: int = state.get("current_mp", state.get("max_mp", 0))
	var max_mp: int = state.get("max_mp", 1)
	mp_bar.max_value = max_mp
	mp_bar.value = current_mp
	
	# Stats
	var atk: int = PartyManager.get_stat_with_equipment(member_id, "attack")
	var def: int = PartyManager.get_stat_with_equipment(member_id, "defense")
	var spd: int = PartyManager.get_stat_with_equipment(member_id, "speed")
	stats_label.text = "ATK: %d  DEF: %d  SPD: %d" % [atk, def, spd]
	
	# Equipment
	var equipment: Dictionary = PartyManager.get_equipment(member_id)
	var equip_lines: PackedStringArray = []
	
	var weapon_id: String = equipment.get("weapon", "")
	if weapon_id != "":
		var weapon_data: Dictionary = GameData.get_equipment(weapon_id)
		equip_lines.append("Weapon: %s" % weapon_data.get("name", weapon_id))
	else:
		equip_lines.append("Weapon: (none)")
	
	var armor_id: String = equipment.get("armor", "")
	if armor_id != "":
		var armor_data: Dictionary = GameData.get_equipment(armor_id)
		equip_lines.append("Armor: %s" % armor_data.get("name", armor_id))
	else:
		equip_lines.append("Armor: (none)")
	
	var accessory_id: String = equipment.get("accessory", "")
	if accessory_id != "":
		var acc_data: Dictionary = GameData.get_equipment(accessory_id)
		equip_lines.append("Accessory: %s" % acc_data.get("name", accessory_id))
	else:
		equip_lines.append("Accessory: (none)")
	
	equipment_label.text = "\n".join(equip_lines)
