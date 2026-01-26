class_name ArcadeCabinetInteractable
extends Area2D

## Arcade cabinet that can launch a minigame or show placeholder dialogue

signal interaction_started
signal interaction_ended

## Name of this arcade game
@export var game_name: String = "Arcade Game"

## Path to the minigame scene (if empty, shows placeholder dialogue)
@export_file("*.tscn") var minigame_scene: String = ""

## Placeholder dialogue when no minigame is set
@export_multiline var placeholder_text: String = "This game is coming soon!"

func _ready() -> void:
	pass

## Called when the player interacts with this cabinet
func interact() -> void:
	interaction_started.emit()
	
	if not minigame_scene.is_empty():
		# Load minigame scene directly
		var minigame_resource = load(minigame_scene)
		if minigame_resource:
			var minigame_instance = minigame_resource.instantiate()
			# Tell minigame where to return
			if minigame_instance.has_method("set_return_scene"):
				var current_scene = get_tree().current_scene.scene_file_path
				minigame_instance.set_return_scene(current_scene)
			get_tree().root.add_child(minigame_instance)
			get_tree().current_scene.queue_free()
			get_tree().current_scene = minigame_instance
	else:
		# Show placeholder dialogue
		var message = "[%s]\n\n%s" % [game_name, placeholder_text]
		DialogueManager.show_dialogue(message)

## Called when interaction ends
func end_interaction() -> void:
	interaction_ended.emit()
