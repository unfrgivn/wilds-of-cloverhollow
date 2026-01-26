extends CanvasLayer
## EquipmentUI - Simple equipment management screen

signal closed

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var member_label: Label = $Panel/MemberLabel
@onready var weapon_label: Label = $Panel/WeaponLabel
@onready var armor_label: Label = $Panel/ArmorLabel
@onready var accessory_label: Label = $Panel/AccessoryLabel
@onready var stats_label: Label = $Panel/StatsLabel
@onready var instructions_label: Label = $Panel/InstructionsLabel

var current_member_index: int = 0
var party_members: Array = []
var current_slot_index: int = 0
var slots: Array = ["weapon", "armor", "accessory"]

var is_selecting_equipment: bool = false
var available_equipment: Array = []
var equipment_selection_index: int = 0


func _ready() -> void:
	visible = false
	_load_party_members()


func _load_party_members() -> void:
	party_members = PartyManager.party_state.keys()


func open() -> void:
	visible = true
	current_member_index = 0
	current_slot_index = 0
	is_selecting_equipment = false
	_update_display()
	set_process_input(true)


func close() -> void:
	visible = false
	set_process_input(false)
	closed.emit()


func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if event.is_action_pressed("ui_cancel"):
		if is_selecting_equipment:
			is_selecting_equipment = false
			_update_display()
		else:
			close()
		get_viewport().set_input_as_handled()
		return
	
	if is_selecting_equipment:
		_handle_equipment_selection_input(event)
	else:
		_handle_slot_selection_input(event)


func _handle_slot_selection_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_left"):
		current_member_index = (current_member_index - 1 + party_members.size()) % party_members.size()
		_update_display()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		current_member_index = (current_member_index + 1) % party_members.size()
		_update_display()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_up"):
		current_slot_index = (current_slot_index - 1 + slots.size()) % slots.size()
		_update_display()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		current_slot_index = (current_slot_index + 1) % slots.size()
		_update_display()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept"):
		_open_equipment_selection()
		get_viewport().set_input_as_handled()


func _handle_equipment_selection_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_up"):
		equipment_selection_index = (equipment_selection_index - 1 + available_equipment.size()) % available_equipment.size()
		_update_equipment_selection_display()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down"):
		equipment_selection_index = (equipment_selection_index + 1) % available_equipment.size()
		_update_equipment_selection_display()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept"):
		_equip_selected()
		get_viewport().set_input_as_handled()


func _open_equipment_selection() -> void:
	var current_slot: String = slots[current_slot_index]
	available_equipment = _get_equipment_for_slot(current_slot)
	
	# Add "None" option to unequip
	available_equipment.insert(0, {"id": "", "name": "(Unequip)", "attack_bonus": 0, "defense_bonus": 0, "speed_bonus": 0})
	
	equipment_selection_index = 0
	is_selecting_equipment = true
	_update_equipment_selection_display()


func _get_equipment_for_slot(slot: String) -> Array:
	var result: Array = []
	var all_equipment: Array = GameData.get_all_equipment()
	for equip in all_equipment:
		if equip.get("slot", "") == slot:
			result.append(equip)
	return result


func _equip_selected() -> void:
	var member_id: String = party_members[current_member_index]
	var selected_equip: Dictionary = available_equipment[equipment_selection_index]
	var equip_id: String = selected_equip.get("id", "")
	
	if equip_id == "":
		# Unequip
		var current_slot: String = slots[current_slot_index]
		PartyManager.unequip_slot(member_id, current_slot)
	else:
		PartyManager.equip_item(member_id, equip_id)
	
	is_selecting_equipment = false
	_update_display()


func _update_display() -> void:
	if party_members.is_empty():
		return
	
	var member_id: String = party_members[current_member_index]
	var member: Dictionary = PartyManager.get_member_state(member_id)
	var equipment: Dictionary = PartyManager.get_equipment(member_id)
	
	title_label.text = "Equipment"
	member_label.text = "< %s >" % member.get("name", "Unknown")
	
	# Get equipment names
	var weapon_name: String = _get_equipment_name(equipment.get("weapon", ""))
	var armor_name: String = _get_equipment_name(equipment.get("armor", ""))
	var accessory_name: String = _get_equipment_name(equipment.get("accessory", ""))
	
	# Mark selected slot with arrow
	var weapon_prefix: String = "> " if current_slot_index == 0 else "  "
	var armor_prefix: String = "> " if current_slot_index == 1 else "  "
	var accessory_prefix: String = "> " if current_slot_index == 2 else "  "
	
	weapon_label.text = "%sWeapon: %s" % [weapon_prefix, weapon_name]
	armor_label.text = "%sArmor: %s" % [armor_prefix, armor_name]
	accessory_label.text = "%sAccessory: %s" % [accessory_prefix, accessory_name]
	
	# Show stats with equipment bonuses
	var atk: int = PartyManager.get_stat_with_equipment(member_id, "attack")
	var def: int = PartyManager.get_stat_with_equipment(member_id, "defense")
	var spd: int = PartyManager.get_stat_with_equipment(member_id, "speed")
	stats_label.text = "ATK: %d  DEF: %d  SPD: %d" % [atk, def, spd]
	
	instructions_label.text = "Arrows: Navigate  Accept: Equip  Cancel: Close"


func _update_equipment_selection_display() -> void:
	var current_slot: String = slots[current_slot_index]
	title_label.text = "Select %s" % current_slot.capitalize()
	
	var display_lines: PackedStringArray = PackedStringArray()
	for i in range(available_equipment.size()):
		var equip: Dictionary = available_equipment[i]
		var prefix: String = "> " if i == equipment_selection_index else "  "
		var bonus_text: String = ""
		if equip.get("attack_bonus", 0) != 0:
			bonus_text += " ATK+%d" % equip.get("attack_bonus", 0)
		if equip.get("defense_bonus", 0) != 0:
			bonus_text += " DEF+%d" % equip.get("defense_bonus", 0)
		if equip.get("speed_bonus", 0) != 0:
			bonus_text += " SPD+%d" % equip.get("speed_bonus", 0)
		display_lines.append("%s%s%s" % [prefix, equip.get("name", "?"), bonus_text])
	
	# Temporarily show in weapon/armor/accessory labels
	weapon_label.text = display_lines[0] if display_lines.size() > 0 else ""
	armor_label.text = display_lines[1] if display_lines.size() > 1 else ""
	accessory_label.text = display_lines[2] if display_lines.size() > 2 else ""
	# If more than 3 items, we'd need scrolling - this is a stub for now
	
	member_label.text = ""
	stats_label.text = ""
	instructions_label.text = "Up/Down: Select  Accept: Confirm  Cancel: Back"


func _get_equipment_name(equip_id: String) -> String:
	if equip_id == "":
		return "(None)"
	var equip_data: Dictionary = GameData.get_equipment(equip_id)
	return equip_data.get("name", equip_id)
