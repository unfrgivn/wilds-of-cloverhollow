extends Node

# Minimal placeholder. Expand into inventory, flags, party, and save/load.

var flags := {}
var inventory := {}

func set_flag(key: String, value: bool = true) -> void:
	flags[key] = value

func get_flag(key: String, default_value: bool = false) -> bool:
	return flags.get(key, default_value)
