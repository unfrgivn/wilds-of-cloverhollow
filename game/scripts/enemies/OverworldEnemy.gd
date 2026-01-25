extends Area2D

signal triggered

func _ready() -> void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node) -> void:
    if body is CharacterBody2D:
        emit_signal("triggered")
        # Placeholder: later this will transition to battle.
        print("[enemy] triggered by player")
