extends CharacterBody2D

@export var speed: float = 90.0

## Currently detected interactable (closest one in range)
var _current_interactable: Area2D = null
## All interactables currently in range
var _interactables_in_range: Array[Area2D] = []

## Current sprite base path (for costume system)
var _sprite_base_path: String = "res://game/assets/sprites/characters/player/default"

@onready var interaction_area: Area2D = $InteractionArea
@onready var player_sprite: Sprite2D = get_node_or_null("Sprite")

var _facing_direction: String = "south"
var _walk_frame: int = 0
var _walk_clock: float = 0.0
var _texture_cache: Dictionary[String, Texture2D] = {}
var _last_texture_path: String = ""

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
    if v != Vector2.ZERO:
        _update_facing(v)
        _walk_clock += _delta
        if _walk_clock >= 0.12:
            _walk_clock = 0.0
            _walk_frame = (_walk_frame + 1) % 4
        _update_sprite(true)
    else:
        _walk_clock = 0.0
        _walk_frame = 0
        _update_sprite(false)
    move_and_slide()
    var camera := get_node_or_null("Camera2D") as Camera2D
    if camera:
        camera.global_position = global_position.round()
        camera.force_update_scroll()

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
    _update_sprite_from_costume()


## Update player sprite based on current outfit
func _update_sprite_from_costume() -> void:
    if not player_sprite:
        return
    
    _update_sprite(false)

func _update_sprite(is_walking: bool) -> void:
    if not player_sprite:
        return
    var texture_path := _sprite_base_path + "/"
    if is_walking:
        texture_path += "walk_%s_%d.png" % [_facing_direction, _walk_frame]
    else:
        texture_path += "idle_%s.png" % _facing_direction
    if not ResourceLoader.exists(texture_path):
        texture_path = _sprite_base_path + "/idle.png"
    if texture_path == _last_texture_path:
        return
    _last_texture_path = texture_path
    if not _texture_cache.has(texture_path) and ResourceLoader.exists(texture_path):
        var loaded := load(texture_path)
        if loaded is Texture2D:
            _texture_cache[texture_path] = loaded
    if _texture_cache.has(texture_path):
        player_sprite.texture = _texture_cache[texture_path]

func _update_facing(direction: Vector2) -> void:
    var angle := direction.angle()
    var diagonal: bool = abs(abs(angle) - PI * 0.25) < PI * 0.18 or abs(abs(angle) - PI * 0.75) < PI * 0.18
    var horizontal := direction.x
    var vertical := direction.y
    if diagonal:
        if horizontal > 0.0 and vertical > 0.0:
            _facing_direction = "se"
        elif horizontal > 0.0:
            _facing_direction = "ne"
        elif vertical > 0.0:
            _facing_direction = "sw"
        else:
            _facing_direction = "nw"
    elif abs(horizontal) > abs(vertical):
        _facing_direction = "east" if horizontal > 0.0 else "west"
    else:
        _facing_direction = "south" if vertical > 0.0 else "north"

func get_facing_direction() -> String:
    return _facing_direction

func get_player_sprite() -> Sprite2D:
    return player_sprite


## Get current sprite base path (for external systems)
func get_sprite_base_path() -> String:
    return _sprite_base_path
