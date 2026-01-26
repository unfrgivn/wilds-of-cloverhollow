extends Node
## Global dialogue manager - handles showing/hiding dialogue UI
## Supports both simple text dialogue and branching choices

signal dialogue_shown(text: String)
signal dialogue_hidden
signal dialogue_finished
signal choice_made(choice_index: int, choice_text: String)

var _dialogue_ui: Node = null
var _is_showing: bool = false
var _waiting_for_choice: bool = false
var _current_choices: Array = []

func _ready() -> void:
	# DialogueUI will register itself when it's ready
	pass

## Register the dialogue UI instance (called by DialogueUI on _ready)
func register_ui(ui: Node) -> void:
	_dialogue_ui = ui

## Show dialogue text
func show_dialogue(text: String) -> void:
	if _dialogue_ui == null:
		push_warning("DialogueManager: No dialogue UI registered")
		return
	_is_showing = true
	_waiting_for_choice = false
	_current_choices = []
	_dialogue_ui.show_text(text)
	dialogue_shown.emit(text)

## Show dialogue with choices - player must select an option
## choices: Array of {text: String, response: String, flag: String (optional)}
func show_dialogue_with_choices(prompt: String, choices: Array) -> void:
	if _dialogue_ui == null:
		push_warning("DialogueManager: No dialogue UI registered")
		return
	_is_showing = true
	_waiting_for_choice = true
	_current_choices = choices
	_dialogue_ui.show_choices(prompt, choices)
	dialogue_shown.emit(prompt)

## Called by DialogueUI when player selects a choice
func select_choice(choice_index: int) -> void:
	if not _waiting_for_choice or choice_index < 0 or choice_index >= _current_choices.size():
		return
	
	var choice = _current_choices[choice_index]
	var choice_text = choice.get("text", "")
	var response = choice.get("response", "")
	var flag_to_set = choice.get("flag", "")
	
	# Set story flag if specified
	if flag_to_set != "" and InventoryManager:
		InventoryManager.set_story_flag(flag_to_set)
	
	choice_made.emit(choice_index, choice_text)
	_waiting_for_choice = false
	_current_choices = []
	
	# Show response dialogue if provided
	if response != "":
		show_dialogue(response)
	else:
		hide_dialogue()

## Hide dialogue
func hide_dialogue() -> void:
	if _dialogue_ui == null:
		return
	_is_showing = false
	_waiting_for_choice = false
	_current_choices = []
	_dialogue_ui.hide_dialogue()
	dialogue_hidden.emit()
	dialogue_finished.emit()

## Check if dialogue is currently showing
func is_showing() -> bool:
	return _is_showing

## Check if waiting for player choice
func is_waiting_for_choice() -> bool:
	return _waiting_for_choice
