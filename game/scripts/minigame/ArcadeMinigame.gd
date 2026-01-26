class_name ArcadeMinigame
extends Control

## Simple "catch falling items" minigame for arcade cabinets

signal minigame_completed(score: int)

## Game configuration
@export var game_duration: float = 30.0
@export var spawn_interval: float = 1.5
@export var fall_speed: float = 100.0
@export var catch_zone_width: float = 40.0

## Internal state
var score: int = 0
var time_remaining: float = 0.0
var is_playing: bool = false
var catcher_position: float = 256.0  # Center of 512 width
var falling_items: Array[Dictionary] = []
var spawn_timer: float = 0.0
var return_scene: String = ""

## UI references
@onready var score_label: Label = $UI/ScoreLabel
@onready var time_label: Label = $UI/TimeLabel
@onready var catcher: ColorRect = $GameArea/Catcher
@onready var game_area: Control = $GameArea
@onready var start_prompt: Label = $UI/StartPrompt
@onready var game_over_panel: Panel = $UI/GameOverPanel
@onready var final_score_label: Label = $UI/GameOverPanel/FinalScoreLabel

func _ready() -> void:
	_reset_game()
	start_prompt.visible = true
	game_over_panel.visible = false

func _reset_game() -> void:
	score = 0
	time_remaining = game_duration
	is_playing = false
	spawn_timer = 0.0
	falling_items.clear()
	catcher_position = 256.0
	
	# Clear any existing falling item visuals
	for child in game_area.get_children():
		if child.name.begins_with("FallingItem"):
			child.queue_free()
	
	_update_ui()

func _process(delta: float) -> void:
	if not is_playing:
		# Check for start input
		if Input.is_action_just_pressed("interact") or Input.is_action_just_pressed("ui_accept"):
			if start_prompt.visible:
				_start_game()
			elif game_over_panel.visible:
				_exit_minigame()
		return
	
	# Update game timer
	time_remaining -= delta
	if time_remaining <= 0:
		time_remaining = 0
		_end_game()
		return
	
	# Handle catcher movement
	var move_dir = Input.get_axis("move_left", "move_right")
	catcher_position += move_dir * 200.0 * delta
	catcher_position = clamp(catcher_position, 20.0, 492.0)
	catcher.position.x = catcher_position - catcher.size.x / 2
	
	# Spawn new items
	spawn_timer -= delta
	if spawn_timer <= 0:
		_spawn_item()
		spawn_timer = spawn_interval
	
	# Update falling items
	_update_falling_items(delta)
	
	_update_ui()

func _start_game() -> void:
	is_playing = true
	start_prompt.visible = false
	game_over_panel.visible = false
	_reset_game()
	is_playing = true  # Reset clears this, so set again
	spawn_timer = 0.5  # Start spawning soon

func _end_game() -> void:
	is_playing = false
	game_over_panel.visible = true
	final_score_label.text = "Final Score: %d" % score
	minigame_completed.emit(score)

func _exit_minigame() -> void:
	if return_scene.is_empty():
		return_scene = "res://game/scenes/areas/Area_ArcadeInterior.tscn"
	SceneRouter.goto_area(return_scene, "from_minigame")

func _spawn_item() -> void:
	var item_visual = ColorRect.new()
	item_visual.name = "FallingItem_%d" % falling_items.size()
	item_visual.size = Vector2(16, 16)
	
	# Random x position
	var x_pos = randf_range(40.0, 472.0)
	item_visual.position = Vector2(x_pos - 8, 20)
	
	# Random color for variety
	var colors = [Color(1, 0.5, 0.5), Color(0.5, 1, 0.5), Color(0.5, 0.5, 1), Color(1, 1, 0.5)]
	item_visual.color = colors[randi() % colors.size()]
	
	game_area.add_child(item_visual)
	
	falling_items.append({
		"x": x_pos,
		"y": 20.0,
		"visual": item_visual,
		"active": true
	})

func _update_falling_items(delta: float) -> void:
	var items_to_remove: Array[int] = []
	
	for i in range(falling_items.size()):
		var item = falling_items[i]
		if not item.active:
			continue
		
		# Move item down
		item.y += fall_speed * delta
		
		if is_instance_valid(item.visual):
			item.visual.position.y = item.y
		
		# Check if caught
		var catch_y = 200.0  # Catcher y position
		if item.y >= catch_y - 10 and item.y <= catch_y + 20:
			if abs(item.x - catcher_position) < catch_zone_width / 2:
				# Caught!
				score += 10
				item.active = false
				if is_instance_valid(item.visual):
					item.visual.queue_free()
				items_to_remove.append(i)
				continue
		
		# Check if missed (fell off screen)
		if item.y > 280:
			item.active = false
			if is_instance_valid(item.visual):
				item.visual.queue_free()
			items_to_remove.append(i)
	
	# Remove processed items (in reverse order to preserve indices)
	items_to_remove.reverse()
	for idx in items_to_remove:
		falling_items.remove_at(idx)

func _update_ui() -> void:
	score_label.text = "Score: %d" % score
	time_label.text = "Time: %.1f" % time_remaining

## Set the scene to return to after minigame ends
func set_return_scene(scene_path: String) -> void:
	return_scene = scene_path
