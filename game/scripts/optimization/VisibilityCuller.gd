extends Node

## VisibilityCuller - Attach to entities that should disable processing when off-screen
## Uses VisibleOnScreenNotifier2D to cull processing for performance

## The target node to enable/disable processing on (defaults to parent)
@export var target: Node = null

## Whether to disable physics processing when off-screen
@export var cull_physics_process: bool = true

## Whether to disable regular processing when off-screen
@export var cull_process: bool = true

@onready var notifier: VisibleOnScreenNotifier2D = $VisibleOnScreenNotifier2D


func _ready() -> void:
    if target == null:
        target = get_parent()
    
    if notifier:
        notifier.screen_entered.connect(_on_screen_entered)
        notifier.screen_exited.connect(_on_screen_exited)
        
        # Initialize based on current visibility
        if not notifier.is_on_screen():
            _on_screen_exited()


func _on_screen_entered() -> void:
    if target:
        if cull_process:
            target.set_process(true)
        if cull_physics_process:
            target.set_physics_process(true)
        # Enable any AnimationPlayer if present
        var anim := target.get_node_or_null("AnimationPlayer") as AnimationPlayer
        if anim:
            anim.active = true


func _on_screen_exited() -> void:
    if target:
        if cull_process:
            target.set_process(false)
        if cull_physics_process:
            target.set_physics_process(false)
        # Pause any AnimationPlayer if present  
        var anim := target.get_node_or_null("AnimationPlayer") as AnimationPlayer
        if anim:
            anim.active = false
