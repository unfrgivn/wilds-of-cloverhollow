extends CharacterBody2D

@export var speed: float = 90.0

func _physics_process(_delta: float) -> void:
    var v := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    velocity = v * speed
    move_and_slide()
    # Snap to integer pixels for pixel-stable rendering (no shimmer)
    global_position = global_position.round()
