extends Node2D
class_name PropInstance

@export var prop_def: Resource
@export var variant: int = 0

func _ready() -> void:
	add_to_group("prop_instance")
	var overhang_node: Node = get_node_or_null("OverhangSprite")
	if overhang_node != null:
		overhang_node.add_to_group("prop_overhang")
	_apply_variant()

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

func extract_overhang_node() -> Node:
	var overhang_node: Node = get_node_or_null("OverhangSprite")
	if overhang_node == null:
		return null
	return overhang_node
