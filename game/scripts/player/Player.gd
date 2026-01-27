extends CharacterBody2D

@export var speed: float = 90.0

## Currently detected interactable (closest one in range)
var _current_interactable: Area2D = null
## All interactables currently in range
var _interactables_in_range: Array[Area2D] = []

## Current sprite base path (for costume system)
var _sprite_base_path: String = "res://game/assets/sprites/characters/player/default"

@onready var interaction_area: Area2D = $InteractionArea
@onready var player_sprite: Sprite2D = get_node_or_null("Sprite2D")

func _ready() -> void:
    if interaction_area:
        interaction_area.area_entered.connect(_on_area_entered)
        interaction_area.area_exited.connect(_on_area_exited)
    
    # Connect to costume changes
    if CostumeManager:
        CostumeManager.outfit_equipped.connect(_on_outfit_equipped)
        _apply_equipped_outfit()

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


## Called when a new outfit is equipped
func _on_outfit_equipped(outfit_id: String) -> void:
    _apply_equipped_outfit()


## Apply the currently equipped outfit's sprite
func _apply_equipped_outfit() -> void:
    _sprite_base_path = CostumeManager.get_equipped_sprite_path()
    _update_sprite()


## Update player sprite based on current outfit
## Future: This will load appropriate sprite frames based on direction/animation
func _update_sprite() -> void:
    if not player_sprite:
        return
    
    # Placeholder: Try to load a preview/idle sprite from the costume path
    var texture_path := _sprite_base_path + "/idle.png"
    if ResourceLoader.exists(texture_path):
        player_sprite.texture = load(texture_path)
    # If no sprite exists, keep existing texture (placeholder)


## Get current sprite base path (for external systems)
func get_sprite_base_path() -> String:
    return _sprite_base_path
