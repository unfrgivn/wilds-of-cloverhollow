class_name SpawnMarker
extends Marker3D

@export var spawn_id: String = ""
@export var is_default := false


func _ready() -> void:
	add_to_group("spawn_marker")
