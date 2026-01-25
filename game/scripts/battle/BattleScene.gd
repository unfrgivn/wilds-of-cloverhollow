extends Node2D
## BattleScene - Turn-based battle screen

const CombatantScript := preload("res://game/scripts/battle/Combatant.gd")
const BattleStateScript := preload("res://game/scripts/battle/BattleState.gd")

## Phase constants (mirror BattleState.Phase enum)
const PHASE_STARTING := 0
const PHASE_PLAYER_TURN := 1
const PHASE_ENEMY_TURN := 2
const PHASE_VICTORY := 3
const PHASE_DEFEAT := 4

## Battle state manager
var battle_state = null

## Current menu selection (0=Attack, 1=Skill, 2=Item, 3=Defend, 4=Run)
var menu_selection: int = 0
const MENU_OPTIONS := ["Attack", "Skill", "Item", "Defend", "Run"]

## UI references
@onready var enemy_name_label: Label = $BattleUI/TopHUD/EnemyPanel/EnemyName
@onready var enemy_hp_label: Label = $BattleUI/TopHUD/EnemyPanel/EnemyHP
@onready var party_container: VBoxContainer = $BattleUI/TopHUD/PartyPanel/PartyStats
@onready var command_menu: VBoxContainer = $BattleUI/CommandMenu/MenuContainer
@onready var battle_message: Label = $BattleUI/BattleMessage
@onready var turn_indicator: Label = $BattleUI/TurnIndicator

func _ready() -> void:
	print("[BattleScene] Battle scene loaded")
	_setup_battle()

func _setup_battle() -> void:
	# Load party from GameData
	var party: Array = []
	for member_data in GameData.get_all_party_members():
		party.append(_create_combatant_from_data(member_data, true))
	
	# Create enemy from GameData using enemy_id
	var enemies: Array = []
	var battle_enemy_data: Dictionary = BattleManager.current_enemy_data
	var enemy_id: String = battle_enemy_data.get("enemy_id", "slime")
	var enemy_data: Dictionary = GameData.get_enemy(enemy_id)
	if enemy_data.is_empty():
		# Fallback to placeholder if enemy not found
		push_warning("[BattleScene] Enemy '%s' not found in GameData, using fallback" % enemy_id)
		enemies.append(_create_combatant(battle_enemy_data.get("enemy_name", "Unknown"), 10, 0, 3, 1, 3, false))
	else:
		enemies.append(_create_combatant_from_data(enemy_data, false))
	
	# Initialize battle state
	battle_state = BattleStateScript.new()
	battle_state.setup(party, enemies)
	battle_state.turn_started.connect(_on_turn_started)
	battle_state.turn_ended.connect(_on_turn_ended)
	battle_state.battle_won.connect(_on_battle_won)
	battle_state.battle_lost.connect(_on_battle_lost)
	
	# Update UI
	_update_enemy_ui()
	_update_party_ui()
	_update_menu_ui()
	
	# Start battle
	battle_state.start_battle()

func _create_combatant(cname: String, hp: int, mp: int, atk: int, def: int, spd: int, is_player: bool):
	var c = CombatantScript.new()
	c.display_name = cname
	c.max_hp = hp
	c.current_hp = hp
	c.max_mp = mp
	c.current_mp = mp
	c.attack = atk
	c.defense = def
	c.speed = spd
	c.is_player = is_player
	return c

## Create combatant from data dictionary (loaded from GameData)
func _create_combatant_from_data(data: Dictionary, is_player: bool):
	var c = CombatantScript.new()
	c.display_name = data.get("name", "Unknown")
	c.max_hp = data.get("max_hp", 10)
	c.current_hp = c.max_hp
	c.max_mp = data.get("max_mp", 0)
	c.current_mp = c.max_mp
	c.attack = data.get("attack", 3)
	c.defense = data.get("defense", 1)
	c.speed = data.get("speed", 3)
	c.is_player = is_player
	return c

func _on_turn_started(combatant) -> void:
	print("[BattleScene] Turn started: %s" % combatant.display_name)
	_update_turn_indicator(combatant)
	
	if not combatant.is_player:
		# Enemy AI: simple attack
		await get_tree().create_timer(0.5).timeout
		_execute_enemy_turn(combatant)

func _on_turn_ended(combatant) -> void:
	print("[BattleScene] Turn ended: %s" % combatant.display_name)
	_update_enemy_ui()
	_update_party_ui()

func _on_battle_won() -> void:
	print("[BattleScene] Victory!")
	_show_message("Victory!")
	await get_tree().create_timer(1.0).timeout
	BattleManager.end_battle("victory")

func _on_battle_lost() -> void:
	print("[BattleScene] Defeat...")
	_show_message("Defeat...")
	await get_tree().create_timer(1.0).timeout
	BattleManager.end_battle("defeat")

func _input(event: InputEvent) -> void:
	if battle_state == null:
		return
	if battle_state.phase != PHASE_PLAYER_TURN:
		return
	
	if event.is_action_pressed("ui_up"):
		menu_selection = (menu_selection - 1 + MENU_OPTIONS.size()) % MENU_OPTIONS.size()
		_update_menu_ui()
	elif event.is_action_pressed("ui_down"):
		menu_selection = (menu_selection + 1) % MENU_OPTIONS.size()
		_update_menu_ui()
	elif event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
		_execute_menu_selection()

func _execute_menu_selection() -> void:
	var current = battle_state.get_current_combatant()
	if current == null:
		return
	
	match menu_selection:
		0:  # Attack
			_execute_attack(current, battle_state.get_first_alive_enemy())
		1:  # Skill (placeholder - just show message)
			_show_message("No skills yet!")
		2:  # Item (placeholder)
			_show_message("No items yet!")
		3:  # Defend
			_execute_defend(current)
		4:  # Run
			_execute_run()

func _execute_attack(attacker, target) -> void:
	if target == null:
		return
	var damage: int = target.take_damage(attacker.attack)
	_show_message("%s attacks %s for %d damage!" % [attacker.display_name, target.display_name, damage])
	print("[BattleScene] %s attacks %s for %d damage" % [attacker.display_name, target.display_name, damage])
	await get_tree().create_timer(0.8).timeout
	battle_state.end_current_turn()

func _execute_defend(combatant) -> void:
	combatant.apply_defend()
	_show_message("%s defends!" % combatant.display_name)
	print("[BattleScene] %s defends" % combatant.display_name)
	await get_tree().create_timer(0.5).timeout
	battle_state.end_current_turn()

func _execute_run() -> void:
	_show_message("Escaped!")
	print("[BattleScene] Player fled")
	await get_tree().create_timer(0.5).timeout
	BattleManager.end_battle("flee")

func _execute_enemy_turn(enemy) -> void:
	var target = battle_state.get_first_alive_party_member()
	if target == null:
		battle_state.end_current_turn()
		return
	
	var damage: int = target.take_damage(enemy.attack)
	_show_message("%s attacks %s for %d damage!" % [enemy.display_name, target.display_name, damage])
	print("[BattleScene] %s attacks %s for %d damage" % [enemy.display_name, target.display_name, damage])
	await get_tree().create_timer(0.8).timeout
	battle_state.end_current_turn()

func _update_enemy_ui() -> void:
	if battle_state == null or battle_state.enemies.is_empty():
		return
	var enemy = battle_state.enemies[0]
	if enemy_name_label:
		enemy_name_label.text = enemy.display_name
	if enemy_hp_label:
		enemy_hp_label.text = "HP: %d/%d" % [enemy.current_hp, enemy.max_hp]

func _update_party_ui() -> void:
	if battle_state == null or party_container == null:
		return
	# Clear existing
	for child in party_container.get_children():
		child.queue_free()
	# Add party member stats
	for member in battle_state.party:
		var label := Label.new()
		var status := ""
		if member.is_defeated():
			status = " [KO]"
		elif member.defend_bonus > 0:
			status = " [DEF]"
		label.text = "%s: HP %d/%d  MP %d/%d%s" % [
			member.display_name, member.current_hp, member.max_hp,
			member.current_mp, member.max_mp, status
		]
		label.add_theme_font_size_override("font_size", 8)
		party_container.add_child(label)

func _update_menu_ui() -> void:
	if command_menu == null:
		return
	for i in command_menu.get_child_count():
		var child := command_menu.get_child(i)
		if child is Label:
			var prefix := "> " if i == menu_selection else "  "
			child.text = prefix + MENU_OPTIONS[i]

func _update_turn_indicator(combatant) -> void:
	if turn_indicator:
		turn_indicator.text = "%s's turn" % combatant.display_name

func _show_message(msg: String) -> void:
	if battle_message:
		battle_message.text = msg
	print("[BattleScene] Message: %s" % msg)
