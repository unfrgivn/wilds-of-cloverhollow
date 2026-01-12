extends Node2D
class_name DecalMarker2D

@export var decal_id: String = ""
@export var texture_path: String = ""
@export var size_px: Vector2i = Vector2i(16, 16)
@export var decal_z_index: int = 1

func _ready() -> void:
	add_to_group("marker_decal")
