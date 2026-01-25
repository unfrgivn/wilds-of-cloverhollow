class_name Interactable
extends Area2D

## Base class for all interactable objects (signs, NPCs, items, etc.)

signal interaction_started
signal interaction_ended

## The dialogue/message to show when interacted with
@export_multiline var dialogue_text: String = "..."

## Called when the player interacts with this object
func interact() -> void:
    interaction_started.emit()
    # Subclasses can override for custom behavior
    DialogueManager.show_dialogue(dialogue_text)

## Called when interaction ends (dialogue dismissed, etc.)
func end_interaction() -> void:
    interaction_ended.emit()
