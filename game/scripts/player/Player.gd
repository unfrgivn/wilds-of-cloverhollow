extends CharacterBody2D

@export var speed: float = 90.0

## Currently detected interactable (closest one in range)
var _current_interactable: Area2D = null
## All interactables currently in range
var _interactables_in_range: Array[Area2D] = []

@onready var interaction_area: Area2D = $InteractionArea

func _ready() -> void:
    if interaction_area:
        interaction_area.area_entered.connect(_on_area_entered)
        interaction_area.area_exited.connect(_on_area_exited)

func _physics_process(_delta: float) -> void:
    # Don't move while dialogue is showing
    if DialogueManager.is_showing():
        return
    
    var v := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    velocity = v * speed
    move_and_slide()
    # Snap to integer pixels for pixel-stable rendering (no shimmer)
    global_position = global_position.round()

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed("interact"):
        _try_interact()

func _try_interact() -> void:
    if DialogueManager.is_showing():
        return
    if _current_interactable != null:
        _current_interactable.interact()

func _on_area_entered(area: Area2D) -> void:
    if area.has_method("interact"):
        _interactables_in_range.append(area)
        _update_current_interactable()

func _on_area_exited(area: Area2D) -> void:
    if area in _interactables_in_range:
        _interactables_in_range.erase(area)
        _update_current_interactable()

func _update_current_interactable() -> void:
    if _interactables_in_range.is_empty():
        _current_interactable = null
    else:
        # Pick the closest one
        var closest: Area2D = null
        var closest_dist := INF
        for i in _interactables_in_range:
            var d := global_position.distance_squared_to(i.global_position)
            if d < closest_dist:
                closest_dist = d
                closest = i
        _current_interactable = closest
