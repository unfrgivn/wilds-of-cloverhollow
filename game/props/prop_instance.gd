extends Node2D
class_name PropInstance

const PIPELINE_CONSTANTS: Script = preload("res://game/tools/pipeline_constants.gd")
const SHADOW_AUTHORED_PATH: String = "visuals/shadow.png"
const SHADOW_GENERATED_PATH: String = "_generated/shadow.png"

@export var prop_def: Resource
@export var variant: int = 0
@export_enum("default", "static", "live") var bake_mode: String = "default"

func _ready() -> void:
	add_to_group("prop_instance")
	_ensure_overhang_group()
	_apply_variant()
	_apply_sprite_layout()
	_apply_shadow()

func _ensure_overhang_group() -> void:
	var overhang_node: Node = get_node_or_null("OverhangSprite")
	if overhang_node != null:
		overhang_node.add_to_group("prop_overhang")

func _apply_variant() -> void:
	if not (prop_def is PropDef):
		return
	var def: PropDef = prop_def
	var base_sprite: Sprite2D = get_node_or_null("BaseSprite") as Sprite2D
	if base_sprite != null and def.base_textures.size() > 0:
		var index: int = clamp(variant, 0, def.base_textures.size() - 1)
		var base_texture: Texture2D = def.base_textures[index]
		if base_texture != null:
			base_sprite.texture = base_texture
	var overhang_sprite: Sprite2D = get_node_or_null("OverhangSprite") as Sprite2D
	if overhang_sprite != null and def.overhang_textures.size() > 0:
		var overhang_index: int = clamp(variant, 0, def.overhang_textures.size() - 1)
		var overhang_texture: Texture2D = def.overhang_textures[overhang_index]
		if overhang_texture != null:
			overhang_sprite.texture = overhang_texture

func _apply_sprite_layout() -> void:
	_align_sprite_to_bottom_center(get_node_or_null("BaseSprite") as Sprite2D)
	_align_sprite_to_bottom_center(get_node_or_null("OverhangSprite") as Sprite2D)

func _apply_shadow() -> void:
	var shadow_sprite: Sprite2D = get_node_or_null("ShadowSprite") as Sprite2D
	if shadow_sprite == null:
		return
	if shadow_sprite.texture == null:
		var shadow_texture: Texture2D = _resolve_shadow_texture()
		if shadow_texture != null:
			shadow_sprite.texture = shadow_texture
	_align_shadow_sprite(shadow_sprite)

func _align_sprite_to_bottom_center(sprite: Sprite2D) -> void:
	if sprite == null:
		return
	var texture: Texture2D = sprite.texture
	if texture == null:
		return
	var size: Vector2i = texture.get_size()
	if size.x <= 0 or size.y <= 0:
		return
	sprite.centered = false
	sprite.position = Vector2(-size.x / 2.0, -size.y)

func _align_shadow_sprite(sprite: Sprite2D) -> void:
	var texture: Texture2D = sprite.texture
	if texture == null:
		return
	var size: Vector2i = texture.get_size()
	if size.x <= 0 or size.y <= 0:
		return
	sprite.centered = false
	sprite.position = _shadow_anchor_offset(size)
	sprite.position += Vector2(PIPELINE_CONSTANTS.SHADOW_OFFSET_PX)
	sprite.modulate = Color(1.0, 1.0, 1.0, PIPELINE_CONSTANTS.SHADOW_ALPHA)

func _shadow_anchor_offset(texture_size: Vector2i) -> Vector2:
	var anchor: Vector2i = _shadow_anchor_from_footprint(texture_size)
	if anchor != Vector2i.ZERO:
		return Vector2(-anchor.x, -anchor.y)
	return Vector2(-texture_size.x / 2.0, -texture_size.y)

func _shadow_anchor_from_footprint(texture_size: Vector2i) -> Vector2i:
	if not (prop_def is PropDef):
		return Vector2i.ZERO
	var def: PropDef = prop_def
	if def.footprint_mask == null:
		return Vector2i.ZERO
	if def.footprint_anchor_px == Vector2i.ZERO:
		return Vector2i.ZERO
	var footprint_size: Vector2i = Vector2i(def.footprint_mask.get_size())
	if footprint_size != texture_size:
		return Vector2i.ZERO
	return def.footprint_anchor_px

func _resolve_shadow_texture() -> Texture2D:
	if not (prop_def is PropDef):
		return null
	var def: PropDef = prop_def
	if def.resource_path == "":
		return null
	var base_dir: String = def.resource_path.get_base_dir()
	var authored_path: String = base_dir.path_join(SHADOW_AUTHORED_PATH)
	if ResourceLoader.exists(authored_path):
		var authored_resource: Resource = ResourceLoader.load(authored_path)
		return authored_resource as Texture2D
	var generated_path: String = base_dir.path_join(SHADOW_GENERATED_PATH)
	if ResourceLoader.exists(generated_path):
		var generated_resource: Resource = ResourceLoader.load(generated_path)
		return generated_resource as Texture2D
	return null

func extract_overhang_node() -> Node:
	var overhang_node: Node = get_node_or_null("OverhangSprite")
	if overhang_node == null:
		return null
	return overhang_node
