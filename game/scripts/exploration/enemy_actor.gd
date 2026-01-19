extends Node3D

@export var move_speed := 1.2
@export var patrol_distance := 1.5
@export var battle_scene := ""
@export var encounter_id := ""
@export var return_scene := ""
@export var trigger_enabled := true

var _origin := Vector3.ZERO
var _direction := 1.0

@onready var _encounter_manager = get_node_or_null("/root/EncounterManager")


func _ready() -> void:
	_origin = global_position
	if return_scene.is_empty():
		var current_scene = get_tree().current_scene
		if current_scene != null:
			return_scene = current_scene.scene_file_path


func _physics_process(delta: float) -> void:
	if patrol_distance <= 0.0 or move_speed <= 0.0:
		return
	var left_bound = _origin.x - patrol_distance
	var right_bound = _origin.x + patrol_distance
	var next_x = global_position.x + (_direction * move_speed * delta)
	if next_x > right_bound:
		next_x = right_bound
		_direction = -1.0
	elif next_x < left_bound:
		next_x = left_bound
		_direction = 1.0
	global_position.x = next_x


func _on_trigger_area_body_entered(body: Node) -> void:
	if not trigger_enabled:
		return
	if body == null or body.name != "Player":
		return
	trigger_encounter()


func trigger_encounter() -> void:
	if _encounter_manager == null:
		return
	var started = _encounter_manager.start_encounter(battle_scene, return_scene, encounter_id, name)
	if started:
		trigger_enabled = false
