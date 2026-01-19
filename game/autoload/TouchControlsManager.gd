extends Node

@export var controls_scene: PackedScene = preload("res://game/scenes/ui/TouchControls.tscn")

var _instance: CanvasLayer

func _ready() -> void:
	_ensure_controls()

func _ensure_controls() -> void:
	if DisplayServer.get_name() == "headless":
		return
	if _instance != null and is_instance_valid(_instance):
		return
	if controls_scene == null:
		return
	_instance = controls_scene.instantiate()
	get_tree().root.call_deferred("add_child", _instance)
