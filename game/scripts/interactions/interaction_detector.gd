class_name InteractionDetector
extends Area3D

var _candidates: Array[Interactable] = []
@onready var _game_state = get_node("/root/GameState")

func _ready() -> void:
	area_entered.connect(_on_area_entered)
	area_exited.connect(_on_area_exited)

func _unhandled_input(event: InputEvent) -> void:
	if _game_state.input_blocked:
		return
	if event.is_action_pressed("interact"):
		if try_interact(get_parent()):
			get_viewport().set_input_as_handled()

func try_interact(interactor: Node) -> bool:
	_cleanup_candidates()
	var candidate = _get_best_candidate(interactor)
	if candidate == null:
		return false
	if candidate.can_interact(interactor):
		print("[Interact] ", candidate.name, " @ ", candidate.get_path())
		candidate.interact(interactor)
		return true
	return false

func _on_area_entered(area: Area3D) -> void:
	var interactable = _resolve_interactable(area)
	if interactable == null:
		return
	if _candidates.has(interactable):
		return
	_candidates.append(interactable)

func _on_area_exited(area: Area3D) -> void:
	var interactable = _resolve_interactable(area)
	if interactable == null:
		return
	_candidates.erase(interactable)

func _resolve_interactable(area: Area3D) -> Interactable:
	var current: Node = area
	while current != null:
		if current is Interactable:
			return current
		current = current.get_parent()
	return null

func _get_best_candidate(interactor: Node) -> Interactable:
	var best: Interactable = null
	var best_distance := INF
	var origin = _get_origin(interactor)
	for candidate in _candidates:
		if not is_instance_valid(candidate):
			continue
		var candidate_origin = _get_origin(candidate)
		var distance = origin.distance_to(candidate_origin)
		if distance < best_distance:
			best_distance = distance
			best = candidate
	return best

func _get_origin(node: Node) -> Vector3:
	if node is Node3D:
		return node.global_position
	return global_position

func _cleanup_candidates() -> void:
	for candidate in _candidates.duplicate():
		if not is_instance_valid(candidate):
			_candidates.erase(candidate)
