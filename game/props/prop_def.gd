extends Resource
class_name PropDef

@export var id: String = ""
@export var prefab: PackedScene
@export var base_textures: Array[Texture2D] = []
@export var overhang_textures: Array[Texture2D] = []
@export var blocks_movement: bool = true
@export var footprint_mask: Texture2D
@export var footprint_anchor_px: Vector2i = Vector2i.ZERO
@export var has_overhang: bool = false
@export_enum("static", "live") var default_bake_mode: String = "static"
@export_enum("PROP", "BUILDING", "ROOM_SHELL", "WALL", "DECAL") var category: String = "PROP"
