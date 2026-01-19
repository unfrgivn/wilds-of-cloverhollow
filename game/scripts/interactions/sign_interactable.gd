extends Interactable

@export var speaker_name: String = ""
@export_multiline var message: String = ""

@onready var _dialogue_manager = get_node("/root/DialogueManager")

func interact(_interactor: Node) -> void:
	var line = DialogueLine.new()
	line.speaker_name = speaker_name
	line.text = message
	var lines: Array[DialogueLine] = [line]
	_dialogue_manager.start_dialogue(lines)
