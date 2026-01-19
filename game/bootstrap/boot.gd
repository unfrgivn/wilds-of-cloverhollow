extends Node

const DEFAULT_SCENE = "res://game/scenes/tests/TestRoom_Movement.tscn"

func _ready() -> void:
	get_tree().call_deferred("change_scene_to_file", DEFAULT_SCENE)
