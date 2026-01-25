class_name AreaTransition
extends Area2D
## A zone that triggers area transitions when the player enters

## Path to the target area scene
@export_file("*.tscn") var target_area: String = ""
## Spawn marker ID to use in the target area
@export var target_spawn_id: String = "default"

func _ready() -> void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
    # Only trigger for player
    if body.name != "Player" and not body.is_in_group("player"):
        return
    
    if target_area == "":
        push_warning("AreaTransition: No target_area set")
        return
    
    SceneRouter.go_to_area(target_area, target_spawn_id)
