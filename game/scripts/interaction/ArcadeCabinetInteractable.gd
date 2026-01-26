class_name ArcadeCabinetInteractable
extends Area2D

## Arcade cabinet that shows placeholder minigame message when interacted with

signal interaction_started
signal interaction_ended

## Name of this arcade game
@export var game_name: String = "Arcade Game"

## Placeholder dialogue when interacting
@export_multiline var placeholder_text: String = "This game is coming soon!"

func _ready() -> void:
	pass

## Called when the player interacts with this cabinet
func interact() -> void:
	interaction_started.emit()
	
	var message = "[%s]\n\n%s" % [game_name, placeholder_text]
	DialogueManager.show_dialogue(message)

## Called when interaction ends
func end_interaction() -> void:
	interaction_ended.emit()
