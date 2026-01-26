extends Area2D
## NPC that presents dialogue choices to the player
## Choices can affect story flags and lead to different responses

@export var npc_name: String = "NPC"
@export var greeting: String = "Hello there! What would you like to talk about?"

## Export choices as arrays - Godot doesn't support Array[Dictionary] exports well
## Each choice array has: [text, response, flag_to_set (optional)]
@export var choice_1: Array = ["Talk about weather", "It's a lovely day in Cloverhollow!", ""]
@export var choice_2: Array = ["Ask for help", "I'll help however I can!", ""]
@export var choice_3: Array = ["Say goodbye", "Take care, friend!", ""]
@export var enable_choice_3: bool = true

func interact() -> void:
	var choices = []
	
	if choice_1.size() >= 2:
		choices.append({
			"text": choice_1[0],
			"response": choice_1[1],
			"flag": choice_1[2] if choice_1.size() > 2 else ""
		})
	
	if choice_2.size() >= 2:
		choices.append({
			"text": choice_2[0],
			"response": choice_2[1],
			"flag": choice_2[2] if choice_2.size() > 2 else ""
		})
	
	if enable_choice_3 and choice_3.size() >= 2:
		choices.append({
			"text": choice_3[0],
			"response": choice_3[1],
			"flag": choice_3[2] if choice_3.size() > 2 else ""
		})
	
	if choices.is_empty():
		DialogueManager.show_dialogue(greeting)
	else:
		DialogueManager.show_dialogue_with_choices(greeting, choices)
