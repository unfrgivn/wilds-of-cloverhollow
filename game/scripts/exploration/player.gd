extends CharacterBody3D

@export var move_speed := 4.0

const SPRITE_DIR := "res://game/assets/sprites/characters/fae"
const SPRITE_ID := "fae"
const SPRITE_LOADER := preload("res://game/scripts/exploration/sprite_frames_loader.gd")

enum Facing { E, SE, S, SW, W, NW, N, NE }

const FACING_ORDER := [
	Facing.E,
	Facing.SE,
	Facing.S,
	Facing.SW,
	Facing.W,
	Facing.NW,
	Facing.N,
	Facing.NE,
]

const FACING_NAMES := {
	Facing.E: "E",
	Facing.SE: "SE",
	Facing.S: "S",
	Facing.SW: "SW",
	Facing.W: "W",
	Facing.NW: "NW",
	Facing.N: "N",
	Facing.NE: "NE",
}

var facing: int = Facing.S
var scenario_input := Vector2.ZERO
var scenario_control := false

@onready var animated_sprite: AnimatedSprite3D = $AnimatedSprite3D
@onready var interaction_detector: InteractionDetector = $InteractionDetector
@onready var _game_state = get_node("/root/GameState")


func _ready() -> void:
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	_load_sprite_frames()
	_update_animation(false)


func _load_sprite_frames() -> void:
	if animated_sprite == null:
		return
	var frames = SPRITE_LOADER.build_frames(SPRITE_DIR, SPRITE_ID)
	if frames == null:
		return
	animated_sprite.sprite_frames = frames


func _physics_process(_delta: float) -> void:

	var input_vector = _get_input_vector()
	var move_direction = Vector3(input_vector.x, 0.0, input_vector.y)

	if move_direction.length_squared() > 0.0001:
		move_direction = move_direction.normalized()
		_update_facing(input_vector)

	velocity = move_direction * move_speed
	move_and_slide()
	_update_animation(move_direction.length_squared() > 0.0001)


func _get_input_vector() -> Vector2:
	if scenario_control:
		return scenario_input

	if _game_state.input_blocked:
		return Vector2.ZERO

	return Input.get_vector("move_left", "move_right", "move_up", "move_down")


func _update_facing(input_vector: Vector2) -> void:
	if input_vector.length_squared() <= 0.0001:
		return
	var angle = atan2(input_vector.y, input_vector.x)
	var sector = int(round(angle / (PI / 4.0)))
	var index = (sector + 8) % 8
	facing = FACING_ORDER[index]


func _update_animation(is_moving: bool) -> void:
	if animated_sprite == null:
		return
	if animated_sprite.sprite_frames == null:
		return

	var direction_name = FACING_NAMES[facing].to_lower()
	var anim_name = ("walk_" if is_moving else "idle_") + direction_name

	if animated_sprite.sprite_frames.has_animation(anim_name):
		if animated_sprite.animation != anim_name:
			animated_sprite.play(anim_name)
		return

	if animated_sprite.sprite_frames.has_animation("idle"):
		if animated_sprite.animation != "idle":
			animated_sprite.play("idle")


func set_scenario_input(direction: Vector2) -> void:
	scenario_control = true
	scenario_input = direction.limit_length(1.0)


func clear_scenario_input() -> void:
	scenario_control = false
	scenario_input = Vector2.ZERO


func get_facing_name() -> String:
	return FACING_NAMES[facing]

func try_interact() -> bool:
	if interaction_detector == null:
		return false
	return interaction_detector.try_interact(self)
