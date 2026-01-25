extends RefCounted
## BattleState - manages turn order and battle flow

signal turn_started(combatant)
signal turn_ended(combatant)
signal battle_won
signal battle_lost

enum Phase {
	STARTING,
	PLAYER_TURN,
	ENEMY_TURN,
	VICTORY,
	DEFEAT
}

## All combatants in turn order
var turn_order: Array = []
## Current turn index
var current_turn_index: int = 0
## Current battle phase
var phase: Phase = Phase.STARTING

## Party combatants (player side)
var party: Array = []
## Enemy combatants
var enemies: Array = []

## Initialize battle with party and enemies
func setup(party_members: Array, enemy_list: Array) -> void:
	party = party_members.duplicate()
	enemies = enemy_list.duplicate()
	
	# Build turn order sorted by speed (highest first)
	turn_order.clear()
	turn_order.append_array(party)
	turn_order.append_array(enemies)
	turn_order.sort_custom(_compare_speed)
	
	current_turn_index = 0
	phase = Phase.STARTING

func _compare_speed(a, b) -> bool:
	return a.speed > b.speed

## Get the current combatant whose turn it is
func get_current_combatant():
	if turn_order.is_empty():
		return null
	return turn_order[current_turn_index]

## Start the battle (call after setup)
func start_battle() -> void:
	if turn_order.is_empty():
		return
	_start_current_turn()

## Called when the current combatant finishes their action
func end_current_turn() -> void:
	var current = get_current_combatant()
	if current != null:
		turn_ended.emit(current)
	
	# Check win/lose conditions
	if _all_enemies_defeated():
		phase = Phase.VICTORY
		battle_won.emit()
		return
	
	if _all_party_defeated():
		phase = Phase.DEFEAT
		battle_lost.emit()
		return
	
	# Move to next alive combatant
	_advance_turn()
	_start_current_turn()

func _start_current_turn() -> void:
	var current = get_current_combatant()
	if current == null:
		return
	
	# Skip defeated combatants
	while current.is_defeated():
		_advance_turn_index()
		current = get_current_combatant()
		if current == null:
			return
	
	# Clear defend bonus at start of turn
	current.clear_defend()
	
	# Set phase based on combatant type
	if current.is_player:
		phase = Phase.PLAYER_TURN
	else:
		phase = Phase.ENEMY_TURN
	
	turn_started.emit(current)

func _advance_turn() -> void:
	_advance_turn_index()

func _advance_turn_index() -> void:
	current_turn_index = (current_turn_index + 1) % turn_order.size()

func _all_enemies_defeated() -> bool:
	for enemy in enemies:
		if not enemy.is_defeated():
			return false
	return true

func _all_party_defeated() -> bool:
	for member in party:
		if not member.is_defeated():
			return false
	return true

## Get first alive enemy (for auto-targeting)
func get_first_alive_enemy():
	for enemy in enemies:
		if not enemy.is_defeated():
			return enemy
	return null

## Get first alive party member
func get_first_alive_party_member():
	for member in party:
		if not member.is_defeated():
			return member
	return null
