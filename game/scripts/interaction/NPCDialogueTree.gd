class_name NPCDialogueTree
extends Area2D

## NPC with branching dialogue - cycles through dialogue branches on each interaction

signal interaction_started
signal interaction_ended

## Array of dialogue branches. Each interaction advances to next branch (cycles).
@export var dialogue_branches: Array[String] = []

## Fallback dialogue if no branches defined
@export_multiline var dialogue_text: String = "Hello there!"

## Current branch index
var _current_branch: int = 0

func _ready() -> void:
	# Ensure we have at least one dialogue option
	if dialogue_branches.is_empty() and not dialogue_text.is_empty():
		dialogue_branches.append(dialogue_text)

## Called when the player interacts with this NPC
func interact() -> void:
	interaction_started.emit()
	
	if dialogue_branches.is_empty():
		DialogueManager.show_dialogue("...")
		return
	
	# Show current branch dialogue
	var current_text = dialogue_branches[_current_branch]
	DialogueManager.show_dialogue(current_text)
	
	# Advance to next branch (cycle back to 0 at end)
	_current_branch = (_current_branch + 1) % dialogue_branches.size()

## Called when interaction ends
func end_interaction() -> void:
	interaction_ended.emit()
