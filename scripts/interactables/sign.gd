extends Interactable
class_name SignInteractable
## A sign or plaque that displays text when checked

@export_multiline var sign_text: String = "A sign."

func get_interaction_prompt() -> String:
	return "Check"

func interact(_actor: Node) -> void:
	interaction_started.emit()
	UIRoot.show_dialogue([sign_text])
	await UIRoot.dialogue_finished
	interaction_finished.emit()
