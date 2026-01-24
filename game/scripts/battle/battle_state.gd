extends RefCounted

class_name BattleState

const BattleActor = preload("res://game/scripts/battle/battle_actor.gd")
const PHASE_AWAITING := "awaiting_command"
const PHASE_RESOLVING := "resolving_player"
const PHASE_ENEMY := "enemy_turn"
const PHASE_COMPLETE := "battle_over"

var party: Array = []
var enemies: Array = []
var phase := PHASE_AWAITING
var result := ""
var last_log := ""
var turn_count := 0
var last_player_command := ""
var last_actions: Array = []


func setup(party_list: Array, enemy_list: Array) -> void:
	party = party_list.duplicate()
	enemies = enemy_list.duplicate()
	phase = PHASE_AWAITING
	result = ""
	last_log = ""
	turn_count = 0
	last_player_command = ""
	last_actions = []
	_clear_guards()


func select_command(command_id: String, target_index: int = -1) -> bool:
	if phase != PHASE_AWAITING or not result.is_empty():
		return false
	phase = PHASE_RESOLVING
	last_player_command = command_id
	last_actions.clear()
	_handle_player_command(command_id, target_index)
	if not result.is_empty():
		phase = PHASE_COMPLETE
		return true
	if _has_alive(enemies):
		phase = PHASE_ENEMY
		_handle_enemy_turn()
	if result.is_empty():
		phase = PHASE_AWAITING
	turn_count += 1
	return true


func _handle_player_command(command_id: String, target_index: int) -> void:
	var actor = _first_alive(party)
	if actor == null:
		result = "defeat"
		last_log = "Party has no fighters."
		return
	if command_id == "attack":
		_player_attack(actor, 3, target_index)
		return
	if command_id == "skills":
		_player_attack(actor, 4, target_index, "skill")
		return
	if command_id == "items":
		var healed = actor.heal(2)
		last_log = "%s uses an item (+%d HP)." % [actor.display_name, healed]
		return
	if command_id == "defend":
		actor.guard()
		last_log = "%s braces for impact." % actor.display_name
		return
	if command_id == "run":
		result = "fled"
		last_log = "Party fled the fight."
		return
	last_log = "Command not recognized."


func _player_attack(actor, damage: int, target_index: int = -1, verb: String = "attack") -> void:
	var target = _select_target(enemies, target_index)
	if target == null:
		target = _first_alive(enemies)
	if target == null:
		result = "victory"
		last_log = "No enemies remain."
		return
	_record_action(actor, target, verb)
	var dealt = target.apply_damage(damage)
	var action_label = "attacks"
	if verb == "skill":
		action_label = "uses a skill on"
	last_log = "%s %s %s for %d." % [actor.display_name, action_label, target.display_name, dealt]
	if not target.is_alive():
		last_log = "%s %s and knocks out %s." % [actor.display_name, action_label, target.display_name]
	if not _has_alive(enemies):
		result = "victory"


func _handle_enemy_turn() -> void:
	var attacker = _first_alive(enemies)
	var target = _first_alive(party)
	if attacker == null:
		result = "victory"
		last_log = "Enemies collapse."
		return
	if target == null:
		result = "defeat"
		last_log = "Party defeated."
		return
	_record_action(attacker, target, "attack")
	var dealt = target.apply_damage(2)
	last_log = "%s hits %s for %d." % [attacker.display_name, target.display_name, dealt]
	_clear_guards()
	if not _has_alive(party):
		result = "defeat"


func _select_target(list: Array, target_index: int):
	if target_index < 0 or target_index >= list.size():
		return null
	var target = list[target_index]
	if target != null and target.is_alive():
		return target
	return null


func _record_action(attacker: BattleActor, target: BattleActor, verb: String) -> void:
	var attacker_list = enemies if attacker.is_enemy else party
	var target_list = enemies if target.is_enemy else party
	var action = {
		"attacker_is_enemy": attacker.is_enemy,
		"attacker_index": _index_of_actor(attacker_list, attacker),
		"target_is_enemy": target.is_enemy,
		"target_index": _index_of_actor(target_list, target),
		"verb": verb,
	}
	last_actions.append(action)


func _index_of_actor(list: Array, actor: BattleActor) -> int:
	for i in range(list.size()):
		if list[i] == actor:
			return i
	return -1


func _clear_guards() -> void:
	for member in party:
		member.clear_guard()


func _has_alive(list: Array) -> bool:
	for actor in list:
		if actor.is_alive():
			return true
	return false


func _first_alive(list: Array):
	for actor in list:
		if actor.is_alive():
			return actor
	return null
