class_name ClassroomEventController
extends Node

## Controls the first class cutscene - teacher dialogue, then strange occurrence

@export var player_desk_path: NodePath

var _player: CharacterBody2D
var _camera: Camera2D
var _event_triggered: bool = false
var _player_desk: Area2D


func _ready() -> void:
    # Check if we should trigger the event
    if InventoryManager.has_story_flag("first_class_complete"):
        return
    
    # Find player and camera
    _player = get_tree().get_first_node_in_group("player")
    if _player:
        _camera = _player.get_node_or_null("Camera2D")
    
    # Connect to player desk interaction
    if player_desk_path:
        _player_desk = get_node_or_null(player_desk_path)
        if _player_desk and _player_desk.has_signal("interaction_started"):
            _player_desk.interaction_started.connect(_on_player_desk_interacted)


func _on_player_desk_interacted() -> void:
    # Small delay to let dialogue show first
    await get_tree().create_timer(2.0).timeout
    trigger_class_event()


func trigger_class_event() -> void:
    if _event_triggered:
        return
    _event_triggered = true
    
    # Teacher starts class
    DialogueManager.show_dialogue("Alright class, let's begin today's lesson about Cloverhollow history...")
    await DialogueManager.dialogue_hidden
    
    await get_tree().create_timer(1.0).timeout
    
    DialogueManager.show_dialogue("Long ago, this town was founded by...")
    await DialogueManager.dialogue_hidden
    
    await get_tree().create_timer(0.5).timeout
    
    # Strange occurrence!
    DialogueManager.show_dialogue("*RUMBLE* W-what was that?!")
    _trigger_screen_shake()
    _trigger_lights_flicker()
    
    await DialogueManager.dialogue_hidden
    
    DialogueManager.show_dialogue("The ground is shaking! Everyone stay calm!")
    
    await DialogueManager.dialogue_hidden
    
    await get_tree().create_timer(0.5).timeout
    
    DialogueManager.show_dialogue("Class dismissed! Everyone go home safely!")
    
    await DialogueManager.dialogue_hidden
    
    # Set story flag
    InventoryManager.set_story_flag("first_class_complete", true)


func _trigger_screen_shake() -> void:
    if not _camera:
        return
    
    var original_offset := _camera.offset
    var shake_duration := 1.0
    var shake_intensity := 8.0
    var shake_count := 20
    
    for i in range(shake_count):
        var offset := Vector2(
            randf_range(-shake_intensity, shake_intensity),
            randf_range(-shake_intensity, shake_intensity)
        )
        _camera.offset = original_offset + offset
        await get_tree().create_timer(shake_duration / shake_count).timeout
    
    _camera.offset = original_offset


func _trigger_lights_flicker() -> void:
    # Find or create a flicker overlay
    var overlay := ColorRect.new()
    overlay.color = Color(0, 0, 0, 0)
    overlay.anchors_preset = Control.PRESET_FULL_RECT
    overlay.z_index = 100
    
    var canvas := CanvasLayer.new()
    canvas.layer = 10
    canvas.add_child(overlay)
    add_child(canvas)
    
    # Flicker effect
    for i in range(6):
        overlay.color.a = 0.5
        await get_tree().create_timer(0.08).timeout
        overlay.color.a = 0.0
        await get_tree().create_timer(0.12).timeout
    
    canvas.queue_free()
