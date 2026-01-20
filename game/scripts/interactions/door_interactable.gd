extends "res://game/scripts/interactions/interactable.gd"

const DialogueLine = preload("res://game/scripts/ui/dialogue_line.gd")

@export var target_scene: String = ""
@export var target_spawn_id: String = ""
@export var lock_flag: String = ""
@export_multiline var locked_text: String = "It's locked."
@export var speaker_name: String = ""

@onready var _scene_router = get_node_or_null("/root/SceneRouter")
@onready var _game_state = get_node_or_null("/root/GameState")
@onready var _dialogue_manager = get_node_or_null("/root/DialogueManager")


func can_interact(_interactor: Node) -> bool:
	if target_scene.is_empty():
		return false
	if not lock_flag.is_empty() and _game_state != null:
		return _game_state.get_flag(lock_flag)
	return true


func interact(_interactor: Node) -> void:
	if target_scene.is_empty():
		return
	if not lock_flag.is_empty() and _game_state != null and not _game_state.get_flag(lock_flag):
		_show_locked_line()
		return
	if _scene_router != null:
		_scene_router.goto_scene(target_scene, target_spawn_id)


func _show_locked_line() -> void:
	if _dialogue_manager == null:
		return
	var line = DialogueLine.new()
	line.speaker_name = speaker_name
	line.text = locked_text
	_dialogue_manager.start_dialogue([line])
