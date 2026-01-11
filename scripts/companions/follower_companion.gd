extends CharacterBody2D
class_name FollowerCompanion
## A companion character that follows the player around

signal reached_player

const FOLLOW_DISTANCE: float = 50.0
const STOP_DISTANCE: float = 40.0
const SPEED: float = 180.0
const ACCELERATION: float = 800.0

@export var player_path: NodePath = ""

var _player: Node2D = null
var _facing: String = "down"
var _is_moving: bool = false

@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D


func _ready() -> void:
	# Register with GameState so Maddie persists across scenes
	if GameState:
		GameState.acquire_maddie()
	
	if player_path:
		_player = get_node_or_null(player_path)
	
	if not _player:
		# Try to find player in the scene
		_player = get_tree().get_first_node_in_group("player")
	
	if not _player:
		push_warning("[FollowerCompanion] No player found to follow!")


func _physics_process(delta: float) -> void:
	if not _player:
		return
	
	var distance_to_player := global_position.distance_to(_player.global_position)
	var direction := global_position.direction_to(_player.global_position)
	
	if distance_to_player > FOLLOW_DISTANCE:
		# Move towards player
		var target_velocity := direction * SPEED
		velocity = velocity.move_toward(target_velocity, ACCELERATION * delta)
		_is_moving = true
		_update_facing(direction)
	elif distance_to_player < STOP_DISTANCE:
		# Stop when close enough
		velocity = velocity.move_toward(Vector2.ZERO, ACCELERATION * delta)
		if velocity.length() < 10.0:
			_is_moving = false
			reached_player.emit()
	else:
		# In the sweet spot, slow down
		velocity = velocity.move_toward(Vector2.ZERO, ACCELERATION * 0.5 * delta)
		if velocity.length() < 10.0:
			_is_moving = false
	
	move_and_slide()
	_update_animation()


func _update_facing(direction: Vector2) -> void:
	if abs(direction.x) > abs(direction.y):
		_facing = "right" if direction.x > 0 else "left"
	else:
		_facing = "down" if direction.y > 0 else "up"


func _update_animation() -> void:
	if not sprite:
		return
	
	var anim_name: String
	if _is_moving and velocity.length() > 10.0:
		anim_name = "walk_" + _facing
	else:
		anim_name = "idle_" + _facing
	
	if sprite.animation != anim_name:
		sprite.play(anim_name)


func set_player(player: Node2D) -> void:
	_player = player


func teleport_to_player() -> void:
	if _player:
		var offset := Vector2(randf_range(-30, 30), randf_range(20, 40))
		global_position = _player.global_position + offset
