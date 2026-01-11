extends Area2D
class_name Interactable
## Base class for all interactable objects in the world

# Reserved for future use by subclasses
@warning_ignore("unused_signal")
signal interaction_started
@warning_ignore("unused_signal")
signal interaction_finished

## Override this to provide the prompt text (e.g., "Talk", "Check", "Open")
func get_interaction_prompt() -> String:
	return "Check"

## Override this to define interaction behavior
func interact(_actor: Node) -> void:
	push_warning("[Interactable] Base interact() called - override in subclass")

## Override to conditionally disable interaction
func can_interact() -> bool:
	return true
