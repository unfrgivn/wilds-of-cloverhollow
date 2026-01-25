class_name SpawnMarker
extends Marker2D
## A spawn point marker for player placement after area transitions

## Unique identifier for this spawn point (e.g., "from_forest", "from_town", "default")
@export var marker_id: String = "default"

func _ready() -> void:
    add_to_group("spawn_marker")

func get_marker_id() -> String:
    return marker_id
