class_name PetCompanion
extends CharacterBody2D

## Pet companion that follows the player with consistent spacing
## Features random idle animations when not moving

## Distance to maintain from player
@export var follow_distance: float = 32.0

## Movement speed (should be slightly faster than player to catch up)
@export var move_speed: float = 120.0

## Time between random idle animations (seconds)
@export var idle_animation_interval: float = 5.0

## Reference to player (set in _ready or externally)
var player: CharacterBody2D = null

## Current facing direction
var facing: String = "south"

## Animation state
enum State { IDLE, WALKING, SPECIAL_IDLE }
var current_state: State = State.IDLE

## Timer for random idle animations
var idle_timer: float = 0.0
var special_idle_timer: float = 0.0
var current_special_idle: String = ""

## Idle animations available
var special_idles: Array[String] = ["sit", "scratch", "yawn"]

## Animation frame timer
var anim_timer: float = 0.0
var anim_frame: int = 0
var anim_speed: float = 0.15

## Position history for smooth following
var target_position: Vector2 = Vector2.ZERO

@onready var sprite: Sprite2D = $Sprite

## Accessory overlay sprites (keyed by slot name)
var accessory_overlays: Dictionary = {}


func _ready() -> void:
	# Try to find player in scene
	_find_player()
	target_position = global_position
	
	# Randomize initial idle timer
	idle_timer = randf_range(2.0, idle_animation_interval)
	
	# Setup accessory overlays
	_setup_accessory_overlays()
	
	# Connect to accessory manager signals
	var pam = get_node_or_null("/root/PetAccessoryManager")
	if pam:
		pam.accessory_equipped.connect(_on_accessory_equipped)
		pam.accessory_unequipped.connect(_on_accessory_unequipped)
		_apply_current_accessories()

func _find_player() -> void:
	# Look for player in scene tree
	var players = get_tree().get_nodes_in_group("player")
	if players.size() > 0:
		player = players[0]
	else:
		# Try direct parent search
		var parent = get_parent()
		while parent:
			var p = parent.get_node_or_null("Player")
			if p and p is CharacterBody2D:
				player = p
				break
			parent = parent.get_parent()

func _physics_process(delta: float) -> void:
	if not player:
		_find_player()
		return
	
	# Calculate target position (behind player based on their facing)
	var offset = _get_follow_offset()
	target_position = player.global_position + offset
	
	# Calculate distance to target
	var distance = global_position.distance_to(target_position)
	
	# Determine if we should move
	if distance > follow_distance * 0.5:
		# Move towards target
		current_state = State.WALKING
		var direction = (target_position - global_position).normalized()
		velocity = direction * move_speed
		
		# Update facing based on movement direction
		_update_facing(direction)
		
		# Animate walking
		_animate_walk(delta)
		
		# Reset idle timer when moving
		idle_timer = randf_range(2.0, idle_animation_interval)
		special_idle_timer = 0.0
		current_special_idle = ""
		
		move_and_slide()
		
		# Snap to pixel
		global_position = global_position.round()
	else:
		velocity = Vector2.ZERO
		
		# Handle idle state
		if current_state == State.SPECIAL_IDLE:
			_animate_special_idle(delta)
		else:
			current_state = State.IDLE
			_update_sprite_idle()
			
			# Count down to random idle animation
			idle_timer -= delta
			if idle_timer <= 0:
				_start_random_idle()

func _get_follow_offset() -> Vector2:
	# Follow behind player based on their last movement
	# Default offset is behind and slightly to the side
	return Vector2(-20, 10)  # Behind and slightly down-right

func _update_facing(direction: Vector2) -> void:
	# Determine facing direction from movement
	if abs(direction.x) > abs(direction.y):
		facing = "east" if direction.x > 0 else "west"
	else:
		facing = "south" if direction.y > 0 else "north"

func _animate_walk(delta: float) -> void:
	anim_timer += delta
	if anim_timer >= anim_speed:
		anim_timer = 0.0
		anim_frame = (anim_frame + 1) % 2
	
	_update_sprite_walk()

func _update_sprite_idle() -> void:
	var texture_path = "res://game/assets/sprites/characters/pet/pet_idle_%s.png" % facing
	var tex = load(texture_path)
	if tex:
		sprite.texture = tex

func _update_sprite_walk() -> void:
	var texture_path = "res://game/assets/sprites/characters/pet/pet_walk_%s_%d.png" % [facing, anim_frame]
	var tex = load(texture_path)
	if tex:
		sprite.texture = tex

func _start_random_idle() -> void:
	current_state = State.SPECIAL_IDLE
	current_special_idle = special_idles[randi() % special_idles.size()]
	special_idle_timer = randf_range(1.5, 3.0)  # Duration of special idle
	
	# Load special idle sprite
	var texture_path = "res://game/assets/sprites/characters/pet/pet_%s.png" % current_special_idle
	var tex = load(texture_path)
	if tex:
		sprite.texture = tex

func _animate_special_idle(delta: float) -> void:
	special_idle_timer -= delta
	if special_idle_timer <= 0:
		# Return to normal idle
		current_state = State.IDLE
		current_special_idle = ""
		idle_timer = randf_range(2.0, idle_animation_interval)
		_update_sprite_idle()


## Setup overlay sprites for each accessory slot
func _setup_accessory_overlays() -> void:
	var slots := ["neck", "head", "face", "back"]
	for slot in slots:
		var overlay := Sprite2D.new()
		overlay.name = "AccessoryOverlay_" + slot
		overlay.visible = false
		add_child(overlay)
		accessory_overlays[slot] = overlay


## Apply currently equipped accessories on startup
func _apply_current_accessories() -> void:
	var pam = get_node_or_null("/root/PetAccessoryManager")
	if not pam:
		return
	
	var equipped: Dictionary = pam.get_equipped_accessories()
	for slot in equipped.keys():
		var accessory_id: String = equipped[slot]
		var accessory_data: Dictionary = pam.get_accessory(accessory_id)
		_update_accessory_overlay(slot, accessory_data)


## Called when an accessory is equipped
func _on_accessory_equipped(slot: String, accessory_id: String) -> void:
	var pam = get_node_or_null("/root/PetAccessoryManager")
	if pam:
		var accessory_data: Dictionary = pam.get_accessory(accessory_id)
		_update_accessory_overlay(slot, accessory_data)


## Called when an accessory is unequipped
func _on_accessory_unequipped(slot: String) -> void:
	if accessory_overlays.has(slot):
		var overlay: Sprite2D = accessory_overlays[slot]
		overlay.visible = false
		overlay.texture = null


## Update the overlay sprite for a specific slot
func _update_accessory_overlay(slot: String, accessory_data: Dictionary) -> void:
	if not accessory_overlays.has(slot):
		return
	
	var overlay: Sprite2D = accessory_overlays[slot]
	
	if accessory_data.is_empty():
		overlay.visible = false
		overlay.texture = null
		return
	
	var sprite_path: String = accessory_data.get("sprite_path", "")
	if sprite_path.is_empty():
		overlay.visible = false
		return
	
	if ResourceLoader.exists(sprite_path):
		overlay.texture = load(sprite_path)
		overlay.visible = true
	else:
		# Sprite doesn't exist yet (placeholder)
		overlay.visible = false


## Get current accessory data for a slot
func get_accessory_in_slot(slot: String) -> Dictionary:
	var pam = get_node_or_null("/root/PetAccessoryManager")
	if pam:
		return pam.get_equipped_accessory_data(slot)
	return {}
