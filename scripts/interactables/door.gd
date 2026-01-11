extends Area2D
class_name DoorInteractable
## A door or warp zone that transitions to another scene

@export_file("*.tscn") var target_scene: String = ""
@export var spawn_id: String = ""
@export var is_automatic: bool = false  # If true, triggers on body_entered instead of interact

func _ready() -> void:
	if is_automatic:
		body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
	if body is Player and not SceneRouter.is_transitioning:
		_do_transition()

func get_interaction_prompt() -> String:
	return "Enter"

func interact(_actor: Node) -> void:
	if not is_automatic:
		_do_transition()

func can_interact() -> bool:
	return not target_scene.is_empty() and not SceneRouter.is_transitioning

func _do_transition() -> void:
	if target_scene.is_empty():
		push_warning("[Door] No target scene set")
		return
	SceneRouter.go_to_scene(target_scene, spawn_id)
