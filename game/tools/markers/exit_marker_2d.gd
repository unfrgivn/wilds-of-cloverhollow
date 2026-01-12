extends Area2D
class_name ExitMarker2D

@export var exit_id: String = ""
@export var target_scene_id: String = ""
@export var target_spawn_id: String = "spawn_default"

func _ready() -> void:
	add_to_group("marker_exit")
