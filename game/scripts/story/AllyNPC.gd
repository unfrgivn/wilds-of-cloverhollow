extends Area2D
## AllyNPC - An NPC that provides help/items when talked to during rally phase.
## Sets story flag to track that they've been rallied.

@export var npc_name: String = "Ally"
@export var rally_flag: String = ""
@export var give_item_id: String = ""
@export var give_item_count: int = 1
@export var dialogue_before: Array[String] = ["I'm worried about what's happening..."]
@export var dialogue_after: Array[String] = ["We're in this together!", "Take these supplies."]
@export var dialogue_already_rallied: Array[String] = ["Good luck out there!"]

var _rallied: bool = false


func _ready() -> void:
    body_entered.connect(_on_body_entered)
    if rally_flag != "" and InventoryManager.has_story_flag(rally_flag):
        _rallied = true


func _on_body_entered(body: Node2D) -> void:
    if body.name != "Player":
        return
    
    # Check if villain has been revealed (rally phase is active)
    var villain_revealed: bool = InventoryManager.has_story_flag("villain_revealed")
    
    if not villain_revealed:
        DialogueManager.show_dialogue(dialogue_before)
        return
    
    if _rallied:
        DialogueManager.show_dialogue(dialogue_already_rallied)
        return
    
    # Rally this ally
    _rally_ally()


func _rally_ally() -> void:
    _rallied = true
    
    # Set rally flag
    if rally_flag != "":
        InventoryManager.set_story_flag(rally_flag, true)
    
    # Give item if specified
    if give_item_id != "":
        InventoryManager.add_item(give_item_id, give_item_count)
    
    DialogueManager.show_dialogue(dialogue_after)
    print("[AllyNPC] %s rallied! Gave %s x%d" % [npc_name, give_item_id, give_item_count])
