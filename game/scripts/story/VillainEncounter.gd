extends Area2D
## Villain encounter trigger that plays the villain_reveal cutscene.
## Set story flag after cutscene to prevent re-triggering.

@export var trigger_flag: String = "villain_revealed"
@export var cutscene_id: String = "villain_reveal"
@export var requires_flag: String = ""  # Optional prerequisite flag

var _triggered: bool = false


func _ready() -> void:
    body_entered.connect(_on_body_entered)
    # Check if already triggered
    if InventoryManager.has_story_flag(trigger_flag):
        _triggered = true
        queue_free()  # Remove encounter if already seen


func _on_body_entered(body: Node2D) -> void:
    if body.name != "Player":
        return
    if _triggered:
        return
    
    # Check prerequisite flag if specified
    if requires_flag != "" and not InventoryManager.has_story_flag(requires_flag):
        return
    
    _trigger_encounter()


func _trigger_encounter() -> void:
    _triggered = true
    
    # Set story flag to prevent re-trigger
    InventoryManager.set_story_flag(trigger_flag, true)
    
    # Play the cutscene
    CutsceneManager.play_cutscene(cutscene_id)
    
    # After cutscene, remove self
    CutsceneManager.cutscene_finished.connect(_on_cutscene_finished, CONNECT_ONE_SHOT)


func _on_cutscene_finished(_id: String) -> void:
    queue_free()
