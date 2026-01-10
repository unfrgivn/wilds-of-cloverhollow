extends Node2D
## Main - Bootstrap scene that initializes the game and loads the first area

@onready var fade_overlay: ColorRect = $FadeOverlay
@onready var world: Node2D = $World


func _ready() -> void:
	# Register the fade overlay with SceneRouter
	SceneRouter.set_fade_overlay(fade_overlay)
	
	# For now, just show a message that the game loaded
	print("[Main] Wilds of Cloverhollow initialized!")
	print("[Main] Press interact (Z) to test, menu (C) for inventory")
	
	# TODO: Load the starting scene (Fae's bedroom or town)
	# SceneRouter.go_to_scene("res://scenes/locations/FaeHouse_Bedroom.tscn", "bed")


func _input(event: InputEvent) -> void:
	# Debug: test input actions are working
	if event.is_action_pressed("interact"):
		print("[Main] Interact pressed!")
	elif event.is_action_pressed("menu"):
		print("[Main] Menu pressed!")
		UIRoot.toggle_inventory()
	elif event.is_action_pressed("cancel"):
		print("[Main] Cancel pressed!")
