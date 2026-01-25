extends Resource
## Combatant - represents a party member or enemy in battle

signal hp_changed(new_hp: int, max_hp: int)
signal defeated

## Display name
@export var display_name: String = "Unknown"
## Maximum HP
@export var max_hp: int = 20
## Current HP
@export var current_hp: int = 20
## Maximum MP (for skills)
@export var max_mp: int = 10
## Current MP
@export var current_mp: int = 10
## Base attack power
@export var attack: int = 5
## Base defense
@export var defense: int = 2
## Speed for turn order
@export var speed: int = 5
## Whether this is a player character (party) or enemy
@export var is_player: bool = true

## Temporary defense bonus from Defend action
var defend_bonus: int = 0

## Take damage, returns actual damage dealt
func take_damage(amount: int) -> int:
	var effective_defense := defense + defend_bonus
	var actual_damage := maxi(1, amount - effective_defense)
	current_hp = maxi(0, current_hp - actual_damage)
	hp_changed.emit(current_hp, max_hp)
	
	if current_hp <= 0:
		defeated.emit()
	
	return actual_damage

## Heal HP
func heal(amount: int) -> int:
	var old_hp := current_hp
	current_hp = mini(max_hp, current_hp + amount)
	var healed := current_hp - old_hp
	hp_changed.emit(current_hp, max_hp)
	return healed

## Apply defend stance (bonus defense until next turn)
func apply_defend() -> void:
	defend_bonus = defense  # Double effective defense

## Clear defend stance
func clear_defend() -> void:
	defend_bonus = 0

## Check if defeated
func is_defeated() -> bool:
	return current_hp <= 0

## Create a copy with full HP
func create_fresh() -> Resource:
	var script: GDScript = get_script()
	var copy: Resource = script.new()
	copy.display_name = display_name
	copy.max_hp = max_hp
	copy.current_hp = max_hp
	copy.max_mp = max_mp
	copy.current_mp = max_mp
	copy.attack = attack
	copy.defense = defense
	copy.speed = speed
	copy.is_player = is_player
	return copy
