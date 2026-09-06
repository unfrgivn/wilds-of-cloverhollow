extends Node2D
## Continuous pixel-world perimeter walls.

@export var inset: float = 16.0

const WORLD := Rect2(0, 0, 512, 288)
const WALL := 8.0

func _ready() -> void:
	_add_wall("Top", Vector2(WORLD.size.x * 0.5, inset - WALL * 0.5), Vector2(WORLD.size.x, WALL))
	_add_wall("Bottom", Vector2(WORLD.size.x * 0.5, WORLD.size.y - inset + WALL * 0.5), Vector2(WORLD.size.x, WALL))
	_add_wall("Left", Vector2(inset - WALL * 0.5, WORLD.size.y * 0.5), Vector2(WALL, WORLD.size.y))
	_add_wall("Right", Vector2(WORLD.size.x - inset + WALL * 0.5, WORLD.size.y * 0.5), Vector2(WALL, WORLD.size.y))

func _add_wall(label: String, wall_position: Vector2, wall_size: Vector2) -> void:
	var body := StaticBody2D.new()
	body.name = label
	body.position = wall_position
	var shape := CollisionShape2D.new()
	var rectangle := RectangleShape2D.new()
	rectangle.size = wall_size
	shape.shape = rectangle
	body.add_child(shape)
	add_child(body)
