extends RefCounted

class_name BattleActor

var id: String
var display_name: String
var max_hp: int
var hp: int
var max_mp: int
var mp: int
var is_enemy: bool
var guarding := false


func _init(id: String = "", display_name: String = "", max_hp: int = 1, max_mp: int = 0, is_enemy: bool = false) -> void:
	self.id = id
	self.display_name = display_name
	self.max_hp = max(1, max_hp)
	hp = self.max_hp
	self.max_mp = max(0, max_mp)
	mp = self.max_mp
	self.is_enemy = is_enemy


func is_alive() -> bool:
	return hp > 0


func apply_damage(amount: int) -> int:
	var damage = max(0, amount)
	if guarding:
		damage = max(1, damage - 1)
	hp = max(0, hp - damage)
	return damage


func heal(amount: int) -> int:
	var value = max(0, amount)
	hp = min(max_hp, hp + value)
	return value


func guard() -> void:
	guarding = true


func clear_guard() -> void:
	guarding = false
