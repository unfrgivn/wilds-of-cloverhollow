extends Node

const DEFAULT_SCENE = "res://game/scenes/areas/cloverhollow/Area_Cloverhollow_Town.tscn"

func _ready() -> void:
	get_tree().call_deferred("change_scene_to_file", DEFAULT_SCENE)
