extends Area2D
class_name HiddenSigil
## A hidden interactable that only appears when the Blacklight Lantern is active

@export var sigil_id: String = ""
@export_multiline var hidden_text: String = "Strange symbols glow under the blacklight..."
@export_multiline var revealed_text: String = "The sigil pulses with an otherworldly energy."
@export var quest_flag_on_reveal: String = ""

var _is_revealed: bool = false

func _ready() -> void:
	collision_layer = 2
	if sigil_id.is_empty():
		sigil_id = str(get_instance_id())
	_is_revealed = GameState.get_flag("sigil_revealed_" + sigil_id)

func _process(_delta: float) -> void:
	# Check if lantern is active to show/hide the sigil
	var lantern_active := GameState.get_flag("blacklight_lantern_active")
	visible = lantern_active or _is_revealed

func get_interaction_prompt() -> String:
	if _is_revealed:
		return "Examine"
	return "Check"

func interact(_actor: Node) -> void:
	var lantern_active := GameState.get_flag("blacklight_lantern_active")
	
	if not _is_revealed and lantern_active:
		_is_revealed = true
		GameState.set_flag("sigil_revealed_" + sigil_id, true)
		if not quest_flag_on_reveal.is_empty():
			GameState.set_flag(quest_flag_on_reveal, true)
		UIRoot.show_dialogue([hidden_text, revealed_text])
	elif _is_revealed:
		UIRoot.show_dialogue([revealed_text])
	else:
		UIRoot.show_dialogue(["You sense something here... but you can't quite see it."])
	
	await UIRoot.dialogue_finished

func can_interact() -> bool:
	var lantern_active := GameState.get_flag("blacklight_lantern_active")
	return lantern_active or _is_revealed
