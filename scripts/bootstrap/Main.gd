extends Node2D
class_name MainScene
## Main - Bootstrap scene that initializes the game and loads the first area

const STARTING_SCENE: String = "res://scenes/locations/fae_bedroom.tscn"
const STARTING_SPAWN: String = "default"

@onready var player: Player = $Player
@onready var animation_player: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
	print("[Main] Wilds of Cloverhollow initialized!")
	
	player.can_move = false
	animation_player.play("fade_in")
	
	# Load the starting scene (UIRoot handles fade overlay)
	_load_starting_scene()


func _load_starting_scene() -> void:
	# Small delay to let autoloads finish initializing
	await get_tree().process_frame
	SceneRouter.go_to_scene(STARTING_SCENE, STARTING_SPAWN)

func _on_level_loaded(_anim_name: String) -> void:
	player.can_move = true
