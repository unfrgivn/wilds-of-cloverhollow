extends CharacterBody2D
class_name Player

## Player controller for top-down movement and interaction

signal player_positioned  # Emitted after player moves to spawn point

@export var move_speed: float = 150.0
@export var acceleration: float = 1200.0
@export var friction: float = 1200.0

var can_move: bool = true
var _nearby_interactable: Interactable = null

@onready var interaction_area: Area2D = $InteractionArea
@onready var animated_sprite: AnimatedSprite2D = $AnimatedSprite2D

var _facing_direction: String = "down"

func _ready() -> void:
	interaction_area.body_entered.connect(_on_interactable_entered)
	interaction_area.body_exited.connect(_on_interactable_exited)
	interaction_area.area_entered.connect(_on_interactable_area_entered)
	interaction_area.area_exited.connect(_on_interactable_area_exited)
	
	# Position at spawn point if SceneRouter has one pending
	_move_to_spawn_point()


func _move_to_spawn_point() -> void:
	var spawn_id := SceneRouter.get_and_clear_spawn_id()
	if spawn_id.is_empty():
		player_positioned.emit()
		return
	
	# Find SpawnPoints node in current scene
	var spawn_points := get_tree().current_scene.get_node_or_null("SpawnPoints")
	if not spawn_points:
		push_warning("[Player] No SpawnPoints node in scene")
		player_positioned.emit()
		return
	
	# Find the specific spawn marker
	for child in spawn_points.get_children():
		if child.has_method("get_spawn_id") and child.get_spawn_id() == spawn_id:
			global_position = child.global_position
			print("[Player] Spawned at: %s (%s)" % [spawn_id, global_position])
			player_positioned.emit()
			return
		# Also check if it has spawn_id property directly
		if "spawn_id" in child and child.spawn_id == spawn_id:
			global_position = child.global_position
			print("[Player] Spawned at: %s (%s)" % [spawn_id, global_position])
			player_positioned.emit()
			return
	
	push_warning("[Player] Spawn point not found: %s" % spawn_id)
	player_positioned.emit()

func _physics_process(delta: float) -> void:
	if not can_move or UIRoot.is_dialogue_active:
		velocity = Vector2.ZERO
		return
	
	var input_vector := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	if input_vector != Vector2.ZERO:
		velocity = velocity.move_toward(input_vector * move_speed, acceleration * delta)
		_update_facing_direction(input_vector)
		_play_walk_animation()
	else:
		velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
		_play_idle_animation()
	
	move_and_slide()


func _update_facing_direction(input: Vector2) -> void:
	# Prioritize horizontal or vertical based on which is stronger
	if abs(input.x) > abs(input.y):
		_facing_direction = "right" if input.x > 0 else "left"
	else:
		_facing_direction = "down" if input.y > 0 else "up"


func _play_walk_animation() -> void:
	var anim_name := "walk_" + _facing_direction
	if animated_sprite.animation != anim_name:
		animated_sprite.play(anim_name)


func _play_idle_animation() -> void:
	var anim_name := "idle_" + _facing_direction
	if animated_sprite.animation != anim_name:
		animated_sprite.play(anim_name)

func _unhandled_input(event: InputEvent) -> void:
	if UIRoot.is_dialogue_active:
		return
	
	if event.is_action_pressed("interact") and _nearby_interactable:
		if _nearby_interactable.can_interact():
			get_viewport().set_input_as_handled()
			_nearby_interactable.interact(self)
	
	# Toggle Blacklight Lantern with menu button
	if event.is_action_pressed("menu"):
		_toggle_lantern()

func _toggle_lantern() -> void:
	if not GameState.has_item("blacklight_lantern"):
		UIRoot.show_notification("You don't have a light source.")
		return
	
	var is_active: bool = GameState.get_flag("blacklight_lantern_active")
	GameState.set_flag("blacklight_lantern_active", not is_active)
	
	if not is_active:
		UIRoot.show_notification("Blacklight Lantern ON")
	else:
		UIRoot.show_notification("Blacklight Lantern OFF")

func _on_interactable_entered(body: Node2D) -> void:
	if body is Interactable:
		_set_nearby_interactable(body)

func _on_interactable_exited(body: Node2D) -> void:
	if body == _nearby_interactable:
		_clear_nearby_interactable()

func _on_interactable_area_entered(area: Area2D) -> void:
	if area is Interactable:
		_set_nearby_interactable(area)

func _on_interactable_area_exited(area: Area2D) -> void:
	if area == _nearby_interactable:
		_clear_nearby_interactable()

func _set_nearby_interactable(interactable: Interactable) -> void:
	_nearby_interactable = interactable
	UIRoot.show_interaction_prompt(_nearby_interactable.get_interaction_prompt())

func _clear_nearby_interactable() -> void:
	_nearby_interactable = null
	UIRoot.hide_interaction_prompt()
