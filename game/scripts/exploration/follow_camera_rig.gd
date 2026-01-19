extends Node3D

@export var target_path: NodePath
@export var follow_offset := Vector3(0.0, 8.0, 8.0)
@export var camera_size := 11.5

@onready var camera: Camera3D = $Camera3D

var target: Node3D


func _ready() -> void:
	if target_path != NodePath():
		target = get_node_or_null(target_path)

	if camera != null:
		camera.projection = Camera3D.PROJECTION_ORTHOGONAL
		camera.size = camera_size
		camera.keep_aspect = Camera3D.KEEP_HEIGHT
		camera.current = true


func _physics_process(_delta: float) -> void:
	if target == null and target_path != NodePath():
		target = get_node_or_null(target_path)
	if target == null:
		return

	var target_position = target.global_position
	global_position = target_position + follow_offset
	camera.look_at(target_position, Vector3.UP)
