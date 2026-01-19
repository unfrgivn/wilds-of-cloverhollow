class_name Interactable
extends Node3D

@export var prompt_text: String = ""

func _ready() -> void:
	add_to_group("interactable")

func can_interact(_interactor: Node) -> bool:
	return true

func interact(_interactor: Node) -> void:
	pass
