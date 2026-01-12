extends RefCounted
class_name WalkMask

const WALKABLE_LUMINANCE: float = 0.5
const WALKABLE_ALPHA: float = 0.5

var _image: Image
var _size: Vector2i = Vector2i.ZERO
var _is_ready: bool = false

func load_from_path(path: String) -> void:
	_is_ready = false
	_image = Image.new()
	var texture: Texture2D = load(path)
	if texture != null:
		var tex_image: Image = texture.get_image()
		if tex_image != null and not tex_image.is_empty():
			_image = tex_image
			_size = _image.get_size()
			_is_ready = true
			return
	var error: Error = _image.load(path)
	if error != OK:
		push_error("[WalkMask] Failed to load walkmask: %s (%s)" % [path, error])
		return
	_size = _image.get_size()
	_is_ready = true

func is_walkable(world_pos: Vector2) -> bool:
	if not _is_ready:
		return false
	var px: int = int(floor(world_pos.x))
	var py: int = int(floor(world_pos.y))
	if px < 0 or py < 0 or px >= _size.x or py >= _size.y:
		return false
	var color: Color = _image.get_pixel(px, py)
	var luminance: float = (color.r + color.g + color.b) / 3.0
	return luminance >= WALKABLE_LUMINANCE and color.a >= WALKABLE_ALPHA

func get_size() -> Vector2i:
	return _size
