extends Node2D
## BattleScene - Turn-based battle screen

const CombatantScript := preload("res://game/scripts/battle/Combatant.gd")
const BattleStateScript := preload("res://game/scripts/battle/BattleState.gd")
const VictoryScreenScene := preload("res://game/scenes/battle/VictoryScreen.tscn")
const GameOverScreenScene := preload("res://game/scenes/battle/GameOverScreen.tscn")

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

## Target selection state
var selecting_target: bool = false
var target_selection: int = 0
var selectable_targets: Array = []
var pending_action: String = ""

## Victory screen instance
var victory_screen = null

## Game over screen instance
var game_over_screen = null

## Boss phase tracking
var boss_phase: int = 1
var boss_phase_triggered: bool = false

## UI references
@onready var enemy_name_label: Label = $BattleUI/TopHUD/EnemyPanel/EnemyName
@onready var enemy_hp_label: Label = $BattleUI/TopHUD/EnemyPanel/EnemyHP
@onready var party_container: VBoxContainer = $BattleUI/TopHUD/PartyPanel/PartyStats
@onready var command_menu: VBoxContainer = $BattleUI/CommandMenu/MenuContainer
@onready var battle_message: Label = $BattleUI/BattleMessage
@onready var turn_indicator: Label = $BattleUI/TurnIndicator
@onready var background_sprite: Sprite2D = $Background
@onready var turn_order_container: HBoxContainer = $BattleUI/TurnOrderPanel/TurnOrderContainer

func _ready() -> void:
	print("[BattleScene] Battle scene loaded")
	_set_background_for_biome()
	_setup_battle()

func _set_background_for_biome() -> void:
	## Set battle background based on current biome/location
	var biome: String = BattleManager.current_enemy_data.get("biome", "cloverhollow")
	var bg_paths: Dictionary = {
		"cloverhollow": "res://game/assets/backgrounds/battle/cloverhollow_meadow.png",
		"town_square": "res://game/assets/backgrounds/battle/town_square.png",
		"park": "res://game/assets/backgrounds/battle/park.png",
		"school_courtyard": "res://game/assets/backgrounds/battle/school_courtyard.png",
		"bubblegum_bay": "res://game/assets/backgrounds/battle/bubblegum_bay.png"
	}
	var bg_path: String = bg_paths.get(biome, bg_paths["cloverhollow"])
	if background_sprite and ResourceLoader.exists(bg_path):
		background_sprite.texture = load(bg_path)
		print("[BattleScene] Set background to: %s" % bg_path)

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
	SFXManager.play("victory")
	_show_message("Victory!")
	await get_tree().create_timer(0.5).timeout
	
	# Calculate rewards from defeated enemies
	var total_xp: int = 0
	var total_gold: int = 0
	var items_dropped: Array = []
	
	for enemy_combatant in battle_state.enemies:
		# Look up enemy data to get xp/gold/drops
		var battle_enemy_data: Dictionary = BattleManager.current_enemy_data
		var enemy_id: String = battle_enemy_data.get("enemy_id", "slime")
		var enemy_data: Dictionary = GameData.get_enemy(enemy_id)
		
		total_xp += enemy_data.get("xp", 5)
		total_gold += enemy_data.get("gold", 0)
		
		# Roll for drops (100% chance for now, since we don't have drop rates)
		var drops: Array = enemy_data.get("drops", [])
		for drop_id in drops:
			if not items_dropped.has(drop_id):
				items_dropped.append(drop_id)
	
	# Show victory screen
	victory_screen = VictoryScreenScene.instantiate()
	add_child(victory_screen)
	victory_screen.continue_pressed.connect(_on_victory_continue)
	victory_screen.show_victory(total_xp, total_gold, items_dropped)

func _on_battle_lost() -> void:
	print("[BattleScene] Defeat...")
	SFXManager.play("defeat")
	_show_message("Defeat...")
	await get_tree().create_timer(0.5).timeout
	
	# Show game over screen
	game_over_screen = GameOverScreenScene.instantiate()
	add_child(game_over_screen)
	game_over_screen.retry_pressed.connect(_on_game_over_retry)
	game_over_screen.return_to_title_pressed.connect(_on_game_over_title)
	game_over_screen.show_game_over()

func _on_victory_continue() -> void:
	# Clean up victory screen and return to overworld
	if victory_screen:
		victory_screen.queue_free()
		victory_screen = null
	BattleManager.end_battle("victory")

func _on_game_over_retry() -> void:
	# Clean up game over screen and restart battle
	if game_over_screen:
		game_over_screen.queue_free()
		game_over_screen = null
	# Reload battle with same enemy data
	BattleManager.start_battle(BattleManager.current_enemy_data)

func _on_game_over_title() -> void:
	# Clean up game over screen and return to title
	if game_over_screen:
		game_over_screen.queue_free()
		game_over_screen = null
	# Load saved game or title screen
	if SaveManager.has_save():
		SaveManager.load_game()
	else:
		BattleManager.end_battle("defeat")

func _input(event: InputEvent) -> void:
	if battle_state == null:
		return
	if battle_state.phase != PHASE_PLAYER_TURN:
		return
	
	# Target selection mode
	if selecting_target:
		if event.is_action_pressed("ui_left"):
			target_selection = (target_selection - 1 + selectable_targets.size()) % selectable_targets.size()
			_update_target_ui()
		elif event.is_action_pressed("ui_right"):
			target_selection = (target_selection + 1) % selectable_targets.size()
			_update_target_ui()
		elif event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
			_confirm_target_selection()
		elif event.is_action_pressed("ui_cancel"):
			_cancel_target_selection()
		return
	
	# Menu navigation mode
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
		0:  # Attack - start target selection
			_start_target_selection("attack", battle_state.get_alive_enemies())
		1:  # Skill (placeholder - just show message)
			_show_message("No skills yet!")
		2:  # Item (placeholder)
			_show_message("No items yet!")
		3:  # Defend
			_execute_defend(current)
		4:  # Run
			_execute_run()

func _start_target_selection(action: String, targets: Array) -> void:
	if targets.is_empty():
		_show_message("No valid targets!")
		return
	pending_action = action
	selectable_targets = targets
	target_selection = 0
	selecting_target = true
	_show_message("Select target (Left/Right, Confirm/Cancel)")
	_update_target_ui()

func _update_target_ui() -> void:
	if selectable_targets.is_empty():
		return
	var target = selectable_targets[target_selection]
	_show_message("Target: %s" % target.display_name)
	# Future: highlight target sprite

func _confirm_target_selection() -> void:
	var current = battle_state.get_current_combatant()
	var target = selectable_targets[target_selection]
	selecting_target = false
	match pending_action:
		"attack":
			_execute_attack(current, target)

func _cancel_target_selection() -> void:
	selecting_target = false
	selectable_targets = []
	pending_action = ""
	_update_menu_ui()
	_show_message("Select action")

func _execute_attack(attacker, target) -> void:
	if target == null:
		return
	var damage: int = target.take_damage(attacker.attack)
	SFXManager.play_attack_hit()
	_show_message("%s attacks %s for %d damage!" % [attacker.display_name, target.display_name, damage])
	print("[BattleScene] %s attacks %s for %d damage" % [attacker.display_name, target.display_name, damage])
	
	# Check for boss phase change
	await _check_boss_phase_change(target)
	
	await get_tree().create_timer(0.8).timeout
	battle_state.end_current_turn()

func _execute_defend(combatant) -> void:
	combatant.apply_defend()
	SFXManager.play("defend")
	_show_message("%s defends!" % combatant.display_name)
	print("[BattleScene] %s defends" % combatant.display_name)
	await get_tree().create_timer(0.5).timeout
	battle_state.end_current_turn()

func _execute_run() -> void:
	# Calculate flee success rate based on average party speed vs average enemy speed
	var party_speed: int = 0
	var party_count: int = 0
	for member in battle_state.party:
		if not member.is_defeated():
			party_speed += member.speed
			party_count += 1
	
	var enemy_speed: int = 0
	var enemy_count: int = 0
	for enemy in battle_state.enemies:
		if not enemy.is_defeated():
			enemy_speed += enemy.speed
			enemy_count += 1
	
	# Calculate average speeds (avoid divide by zero)
	var avg_party_speed: float = float(party_speed) / max(party_count, 1)
	var avg_enemy_speed: float = float(enemy_speed) / max(enemy_count, 1)
	
	# Base flee chance: 50% + 5% per point of speed advantage, capped at 10-90%
	var speed_diff: float = avg_party_speed - avg_enemy_speed
	var flee_chance: float = clampf(0.5 + (speed_diff * 0.05), 0.1, 0.9)
	
	# Roll for escape
	var roll: float = randf()
	print("[BattleScene] Flee attempt: party_speed=%d, enemy_speed=%d, chance=%.0f%%, roll=%.2f" % [party_speed, enemy_speed, flee_chance * 100, roll])
	
	if roll < flee_chance:
		SFXManager.play("run_away")
		_show_message("Got away safely!")
		print("[BattleScene] Player fled successfully")
		await get_tree().create_timer(0.5).timeout
		BattleManager.end_battle("flee")
	else:
		_show_message("Couldn't escape!")
		print("[BattleScene] Flee failed")
		await get_tree().create_timer(0.5).timeout
		battle_state.end_current_turn()

func _execute_enemy_turn(enemy) -> void:
	var target = battle_state.get_first_alive_party_member()
	if target == null:
		battle_state.end_current_turn()
		return
	
	# Get enemy's skills from GameData
	var enemy_data: Dictionary = BattleManager.current_enemy_data
	var enemy_id: String = enemy_data.get("enemy_id", "slime")
	var full_data: Dictionary = GameData.get_enemy(enemy_id)
	var skills: Array = full_data.get("skills", [])
	
	# Check if enemy is low on HP (below 30%)
	var hp_ratio: float = float(enemy.current_hp) / float(enemy.max_hp)
	var needs_heal: bool = hp_ratio < 0.3
	
	# Check for healing skills if low HP
	if needs_heal:
		for skill_id in skills:
			var skill_data: Dictionary = GameData.get_skill(skill_id)
			if skill_data.get("type", "") == "heal" and enemy.current_mp >= skill_data.get("mp_cost", 0):
				# Use healing skill
				var heal_power: int = skill_data.get("power", 10)
				var healed: int = enemy.heal(heal_power)
				enemy.current_mp -= skill_data.get("mp_cost", 0)
				_show_message("%s uses %s! Heals %d HP!" % [enemy.display_name, skill_data.get("name", "Heal"), healed])
				print("[BattleScene] %s heals for %d (AI: low HP)" % [enemy.display_name, healed])
				await get_tree().create_timer(0.8).timeout
				battle_state.end_current_turn()
				return
	
	# Random chance to use a skill (50% if has skills with enough MP)
	var usable_skills: Array = []
	for skill_id in skills:
		var skill_data: Dictionary = GameData.get_skill(skill_id)
		if skill_data.get("type", "") == "attack" and enemy.current_mp >= skill_data.get("mp_cost", 0):
			usable_skills.append(skill_data)
	
	if not usable_skills.is_empty() and randf() < 0.5:
		# Use a random skill
		var chosen_skill: Dictionary = usable_skills[randi() % usable_skills.size()]
		var skill_power: int = chosen_skill.get("power", 5)
		var damage: int = target.take_damage(enemy.attack + skill_power - target.defense)
		enemy.current_mp -= chosen_skill.get("mp_cost", 0)
		_show_message("%s uses %s on %s for %d damage!" % [enemy.display_name, chosen_skill.get("name", "Attack"), target.display_name, damage])
		print("[BattleScene] %s uses %s on %s for %d damage (AI: skill)" % [enemy.display_name, chosen_skill.get("name", "Attack"), target.display_name, damage])
		await get_tree().create_timer(0.8).timeout
		battle_state.end_current_turn()
		return
	
	# Default: basic attack
	var damage: int = target.take_damage(enemy.attack)
	SFXManager.play("enemy_hit")
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
	_update_turn_order_ui()

func _update_turn_order_ui() -> void:
	if turn_order_container == null or battle_state == null:
		return
	# Clear existing turn order labels (except the "Turn Order:" label)
	var children := turn_order_container.get_children()
	for i in range(children.size() - 1, 0, -1):
		children[i].queue_free()
	# Build turn order from battle state
	var turn_order: Array = battle_state.get_turn_order()
	for i in turn_order.size():
		var combatant = turn_order[i]
		# Add arrow separator
		if i > 0:
			var arrow := Label.new()
			arrow.text = ">"
			arrow.add_theme_font_size_override("font_size", 8)
			turn_order_container.add_child(arrow)
		# Add combatant name
		var name_label := Label.new()
		name_label.text = combatant.display_name
		name_label.add_theme_font_size_override("font_size", 8)
		# Highlight current turn
		if i == 0:
			name_label.modulate = Color(1, 1, 0.5)  # Yellow for current turn
		turn_order_container.add_child(name_label)

func _show_message(msg: String) -> void:
	if battle_message:
		battle_message.text = msg
	print("[BattleScene] Message: %s" % msg)

## Check if boss should change phase
func _check_boss_phase_change(target) -> void:
	if boss_phase_triggered:
		return
	
	# Check if target is a boss enemy
	var enemy_data: Dictionary = BattleManager.current_enemy_data
	var enemy_id: String = enemy_data.get("enemy_id", "")
	var full_data: Dictionary = GameData.get_enemy(enemy_id)
	var flags: Array = full_data.get("flags", [])
	
	if not flags.has("boss") or not flags.has("phase_change"):
		return
	
	# Check HP threshold (default 50%)
	var threshold: int = full_data.get("phase_threshold", 50)
	var hp_percent: float = (float(target.current_hp) / float(target.max_hp)) * 100.0
	
	if hp_percent <= threshold and boss_phase == 1:
		boss_phase = 2
		boss_phase_triggered = true
		
		# Apply phase 2 stat bonuses
		var attack_bonus: int = full_data.get("phase_2_attack_bonus", 2)
		var speed_bonus: int = full_data.get("phase_2_speed_bonus", 1)
		target.attack += attack_bonus
		target.speed += speed_bonus
		
		# Show phase change message
		_show_message("%s enters Phase 2! It's enraged!" % target.display_name)
		print("[BattleScene] BOSS PHASE 2: %s gains +%d ATK, +%d SPD" % [target.display_name, attack_bonus, speed_bonus])
		
		# Boss music trigger stub
		_trigger_boss_music_phase_2()
		
		await get_tree().create_timer(1.0).timeout

## Stub for boss music phase 2 trigger
func _trigger_boss_music_phase_2() -> void:
	print("[BattleScene] STUB: Boss music phase 2 would play here")
