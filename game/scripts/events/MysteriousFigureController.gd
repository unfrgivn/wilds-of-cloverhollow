class_name MysteriousFigureController
extends Node

## Controls the mysterious figure cutscene - shadowy glimpse after first class

@export var shadow_figure_path: NodePath
@export var trigger_area_path: NodePath

var _shadow_figure: Sprite2D
var _trigger_area: Area2D
var _event_triggered: bool = false
var _camera: Camera2D


func _ready() -> void:
	# Only trigger if first class is complete but we haven't seen the figure yet
	if not InventoryManager.has_story_flag("first_class_complete"):
		return
	if InventoryManager.has_story_flag("mysterious_figure_seen"):
		_hide_figure()
		return
	
	# Find components
	if shadow_figure_path:
		_shadow_figure = get_node_or_null(shadow_figure_path)
	if trigger_area_path:
		_trigger_area = get_node_or_null(trigger_area_path)
		if _trigger_area:
			_trigger_area.body_entered.connect(_on_trigger_entered)
	
	# Find camera
	var player := get_tree().get_first_node_in_group("player")
	if player:
		_camera = player.get_node_or_null("Camera2D")
	
	# Initially hide shadow figure
	if _shadow_figure:
		_shadow_figure.visible = false


func _on_trigger_entered(body: Node2D) -> void:
	if _event_triggered:
		return
	if not body.is_in_group("player"):
		return
	
	_event_triggered = true
	trigger_mysterious_figure_event()


func trigger_mysterious_figure_event() -> void:
	if not _shadow_figure:
		_complete_event()
		return
	
	# Show the shadow figure
	_shadow_figure.visible = true
	_shadow_figure.modulate = Color(0.2, 0.2, 0.3, 0.8)  # Dark shadowy tint
	
	# Pause player
	var player := get_tree().get_first_node_in_group("player")
	if player and player.has_method("set_movement_enabled"):
		player.set_movement_enabled(false)
	
	await get_tree().create_timer(0.5).timeout
	
	DialogueManager.show_dialogue("Huh? Who's that...?")
	await DialogueManager.dialogue_hidden
	
	# Figure flickers and vanishes
	await _flicker_and_vanish()
	
	DialogueManager.show_dialogue("They're gone! What was that shadowy figure...?")
	await DialogueManager.dialogue_hidden
	
	DialogueManager.show_dialogue("Something strange is happening in Cloverhollow...")
	await DialogueManager.dialogue_hidden
	
	# Re-enable player
	if player and player.has_method("set_movement_enabled"):
		player.set_movement_enabled(true)
	
	_complete_event()


func _flicker_and_vanish() -> void:
	if not _shadow_figure:
		return
	
	# Flicker effect
	for i in range(4):
		_shadow_figure.visible = false
		await get_tree().create_timer(0.1).timeout
		_shadow_figure.visible = true
		await get_tree().create_timer(0.15).timeout
	
	# Final fade out
	var tween := create_tween()
	tween.tween_property(_shadow_figure, "modulate:a", 0.0, 0.3)
	await tween.finished
	
	_shadow_figure.visible = false


func _hide_figure() -> void:
	if shadow_figure_path:
		var figure := get_node_or_null(shadow_figure_path)
		if figure:
			figure.visible = false


func _complete_event() -> void:
	InventoryManager.set_story_flag("mysterious_figure_seen", true)
