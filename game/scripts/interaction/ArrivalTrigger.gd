class_name ArrivalTrigger
extends Area2D

## Sets a story flag when player enters this area (one-time trigger)

@export var arrival_flag: String = ""
@export var dialogue_text: String = ""

var _triggered: bool = false


func _ready() -> void:
    body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node2D) -> void:
    if _triggered:
        return
    
    if not body.is_in_group("player") and not body.name == "Player":
        return
    
    _triggered = true
    
    # Set story flag if configured
    if not arrival_flag.is_empty():
        InventoryManager.set_story_flag(arrival_flag, true)
    
    # Show dialogue if configured
    if not dialogue_text.is_empty():
        DialogueManager.show_dialogue(dialogue_text)
