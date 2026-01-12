extends Area2D

var walkmask: WalkMask
var speed: float = 140.0

func _ready() -> void:
	var sprite: Sprite2D = get_node_or_null("Sprite2D") as Sprite2D
	if sprite == null:
		push_warning("[Player] Missing Sprite2D")
		return
	if sprite.texture == null:
		var image: Image = Image.create(24, 24, false, Image.FORMAT_RGBA8)
		image.fill(Color(1.0, 0.2, 0.2, 1.0))
		var texture: ImageTexture = ImageTexture.create_from_image(image)
		sprite.texture = texture
		sprite.centered = true

func _physics_process(delta: float) -> void:
	var direction: Vector2 = _read_input()
	if direction == Vector2.ZERO:
		return
	var step: Vector2 = direction * speed * delta
	_move_with_mask(step)

func _read_input() -> Vector2:
	var dir: Vector2 = Vector2.ZERO
	if Input.is_key_pressed(KEY_W):
		dir.y -= 1.0
	if Input.is_key_pressed(KEY_S):
		dir.y += 1.0
	if Input.is_key_pressed(KEY_A):
		dir.x -= 1.0
	if Input.is_key_pressed(KEY_D):
		dir.x += 1.0
	if dir.length() > 0.0:
		dir = dir.normalized()
	return dir

func _move_with_mask(delta_move: Vector2) -> void:
	if walkmask == null:
		position += delta_move
		return
	var target: Vector2 = position + delta_move
	if walkmask.is_walkable(target):
		position = target
		return
	var x_only: Vector2 = Vector2(position.x + delta_move.x, position.y)
	if walkmask.is_walkable(x_only):
		position = x_only
		return
	var y_only: Vector2 = Vector2(position.x, position.y + delta_move.y)
	if walkmask.is_walkable(y_only):
		position = y_only
