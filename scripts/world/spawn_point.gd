extends Marker2D
class_name SpawnPoint
## A named spawn point marker for scene transitions

@export var spawn_id: String = ""

func _ready() -> void:
	# Auto-set spawn_id from node name if not specified
	if spawn_id.is_empty():
		spawn_id = name
