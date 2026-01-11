extends Interactable
class_name ClawMachineInteractable
## A claw machine that launches a playable mini-game

const CLAW_GAME_SCENE: String = "res://scenes/minigames/ClawGame.tscn"

var _game_instance: Node = null


func get_interaction_prompt() -> String:
	return "Play"


func interact(_actor: Node) -> void:
	interaction_started.emit()
	_launch_game()


func _launch_game() -> void:
	if _game_instance:
		push_warning("[ClawMachine] Game already running")
		return
	
	var scene := load(CLAW_GAME_SCENE) as PackedScene
	if not scene:
		push_error("[ClawMachine] Failed to load claw game scene")
		interaction_finished.emit()
		return
	
	_game_instance = scene.instantiate()
	_game_instance.game_finished.connect(_on_game_finished)
	
	# Add to UIRoot so it renders above the game world
	UIRoot.add_child(_game_instance)
	print("[ClawMachine] Claw game started")


func _on_game_finished() -> void:
	if _game_instance:
		_game_instance.queue_free()
		_game_instance = null
	print("[ClawMachine] Claw game ended")
	interaction_finished.emit()
