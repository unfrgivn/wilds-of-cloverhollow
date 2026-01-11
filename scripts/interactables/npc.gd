extends Interactable
class_name NPCInteractable
## An NPC that can be talked to

@export var npc_name: String = "Stranger"
@export var dialogue_lines: Array[String] = ["..."]

func get_interaction_prompt() -> String:
	return "Talk"

func interact(_actor: Node) -> void:
	interaction_started.emit()
	UIRoot.show_dialogue(dialogue_lines, npc_name)
	await UIRoot.dialogue_finished
	interaction_finished.emit()
