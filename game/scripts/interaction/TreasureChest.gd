extends Area2D
## Hidden treasure chest that gives items when opened.
## Only accessible when dark area is lit (player has lantern).

@export var item_id: String = "potion"
@export var item_count: int = 3
@export var requires_lantern: bool = true
@export var chest_opened_flag: String = ""

var _is_opened: bool = false


func _ready() -> void:
    body_entered.connect(_on_body_entered)
    # Check if already opened via story flag
    if chest_opened_flag != "" and InventoryManager.has_story_flag(chest_opened_flag):
        _is_opened = true
        _show_opened_sprite()


func _on_body_entered(body: Node2D) -> void:
    if body.name != "Player":
        return
    if _is_opened:
        return
    
    # Check lantern requirement
    if requires_lantern and not InventoryManager.has_tool(InventoryManager.TOOL_LANTERN):
        DialogueManager.show_dialogue(["It's too dark to see what's here..."])
        return
    
    # Open the chest
    _open_chest()


func _open_chest() -> void:
    _is_opened = true
    
    # Give items
    InventoryManager.add_item(item_id, item_count)
    
    # Set story flag if specified
    if chest_opened_flag != "":
        InventoryManager.set_story_flag(chest_opened_flag, true)
    
    # Show dialogue
    var item_name := item_id.capitalize()
    DialogueManager.show_dialogue([
        "You found a hidden treasure chest!",
        "Obtained %s x%d!" % [item_name, item_count]
    ])
    
    _show_opened_sprite()


func _show_opened_sprite() -> void:
    # Hide the closed chest sprite to indicate it's opened
    if has_node("Sprite"):
        $Sprite.modulate = Color(0.5, 0.5, 0.5, 0.7)
