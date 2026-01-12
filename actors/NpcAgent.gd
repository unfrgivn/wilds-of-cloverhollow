extends Node2D
class_name NpcAgent

const SPEED: float = 90.0
const TARGET_REACHED: float = 6.0
const TARGET_OFFSET: float = 8.0

@onready var _agent: NavigationAgent2D = $NavigationAgent2D

var _rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _bounds: Vector2i = Vector2i.ZERO
var _has_bounds: bool = false

func _ready() -> void:
	_rng.randomize()
	_agent.avoidance_enabled = false
	_agent.path_desired_distance = 4.0
	_agent.target_desired_distance = TARGET_REACHED
	_agent.radius = 10.0
	_ensure_sprite()
	if _has_bounds:
		_pick_target()

func set_bounds(size_px: Vector2i) -> void:
	_bounds = size_px
	_has_bounds = true
	_pick_target()

func _physics_process(delta: float) -> void:
	if not _has_bounds:
		return
	if _agent.is_navigation_finished():
		_pick_target()
		return
	var next_pos: Vector2 = _agent.get_next_path_position()
	var offset: Vector2 = next_pos - global_position
	if offset.length() < TARGET_REACHED:
		return
	var direction: Vector2 = offset.normalized()
	global_position += direction * SPEED * delta

func _pick_target() -> void:
	if _bounds.x <= 0 or _bounds.y <= 0:
		return
	var target: Vector2 = Vector2(
		_rng.randi_range(0, _bounds.x - 1),
		_rng.randi_range(0, _bounds.y - 1)
	) + Vector2(TARGET_OFFSET, TARGET_OFFSET)
	_agent.set_target_position(target)

func _ensure_sprite() -> void:
	var sprite: Sprite2D = get_node_or_null("Sprite2D") as Sprite2D
	if sprite == null:
		return
	if sprite.texture == null:
		var image: Image = Image.create(20, 20, false, Image.FORMAT_RGBA8)
		image.fill(Color(0.2, 0.6, 1.0, 1.0))
		var texture: ImageTexture = ImageTexture.create_from_image(image)
		sprite.texture = texture
		sprite.centered = true
