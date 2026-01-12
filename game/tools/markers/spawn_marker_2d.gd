extends Node2D
class_name SpawnMarker2D

@export var spawn_id: String = "spawn_default"

func _ready() -> void:
	add_to_group("marker_spawn")
