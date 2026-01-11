extends Area2D
class_name QuestCabinet
## The mysterious arcade cabinet that triggers the quest ending

@export var required_sigils: Array[String] = ["sigil_school", "sigil_town"]

func _ready() -> void:
	collision_layer = 2

func get_interaction_prompt() -> String:
	return "Play"

func interact(_actor: Node) -> void:
	var all_sigils_found := _check_all_sigils()
	var quest_complete := GameState.get_flag("quest.hollow_light.completed")
	
	if quest_complete:
		UIRoot.show_dialogue([
			"The cabinet sits silent now.",
			"Whatever was inside... has moved on.",
			"But you can still feel it watching."
		])
	elif all_sigils_found:
		_trigger_quest_ending()
	elif GameState.has_item("blacklight_lantern"):
		UIRoot.show_dialogue([
			"THE HOLLOW",
			"The screen flickers with static.",
			"Shapes move in the darkness... they seem to be waiting for something.",
			"You feel like you're missing pieces of a puzzle."
		])
	else:
		UIRoot.show_dialogue([
			"THE HOLLOW",
			"The cabinet hums ominously.",
			"The screen shows only static... but you swear something is watching you.",
			"Maybe if you look around town, you'll find some answers."
		])
	
	await UIRoot.dialogue_finished

func _check_all_sigils() -> bool:
	for sigil in required_sigils:
		if not GameState.get_flag("sigil_revealed_" + sigil):
			return false
	return true

func _trigger_quest_ending() -> void:
	GameState.set_flag("quest.hollow_light.completed", true)
	
	UIRoot.show_dialogue([
		"THE HOLLOW",
		"The sigils you found begin to glow on the cabinet's surface.",
		"The static parts... revealing something beyond.",
		"...",
		"A face. No, many faces. Watching.",
		"They speak without sound:",
		"\"YOU FOUND US.\"",
		"\"WE'VE BEEN WAITING.\"",
		"\"THIS IS ONLY THE BEGINNING, FAE.\"",
		"The screen goes dark.",
		"...",
		"Congratulations! You've completed the demo.",
		"The mystery of Cloverhollow is only just beginning..."
	])

func can_interact() -> bool:
	return true
