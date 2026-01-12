extends Area2D
class_name HotspotMarker2D

@export var hotspot_id: String = ""
@export var hotspot_type: String = "talk"
@export var text: String = ""

func _ready() -> void:
	add_to_group("marker_hotspot")
