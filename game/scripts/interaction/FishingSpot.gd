extends Area2D
## FishingSpot - An interactable fishing location
## Requires fishing rod tool to fish. Starts the fishing minigame.

@export var spot_id: String = "default_fishing_spot"
@export var dialogue_no_rod: String = "This looks like a good fishing spot, but you need a fishing rod."
@export var dialogue_start_fishing: String = "Time to fish!"

signal fishing_started
signal fishing_ended(fish_id: String)

const FISHING_MINIGAME_SCENE := preload("res://game/scenes/minigames/FishingMinigame.tscn")

var _fishing_data: Dictionary = {}
var _spot_data: Dictionary = {}

func _ready() -> void:
    _load_fishing_data()

func _load_fishing_data() -> void:
    var file := FileAccess.open("res://game/data/fishing/fishing.json", FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            _fishing_data = json.data
            # Find our spot data
            for spot in _fishing_data.get("fishing_spots", []):
                if spot.get("id", "") == spot_id:
                    _spot_data = spot
                    break
    else:
        push_warning("[FishingSpot] Could not load fishing data")

func interact() -> void:
    if not InventoryManager.has_tool("fishing_rod"):
        DialogueManager.show_dialogue(dialogue_no_rod)
        return
    
    DialogueManager.show_dialogue(dialogue_start_fishing)
    await DialogueManager.dialogue_finished
    
    _start_fishing()

func _start_fishing() -> void:
    fishing_started.emit()
    
    var minigame: CanvasLayer = FISHING_MINIGAME_SCENE.instantiate()
    minigame.spot_data = _spot_data
    minigame.fishing_data = _fishing_data
    minigame.fish_caught.connect(_on_fish_caught)
    minigame.fishing_cancelled.connect(_on_fishing_cancelled)
    get_tree().root.add_child(minigame)
    minigame.start_fishing()

func _on_fish_caught(fish_id: String) -> void:
    InventoryManager.add_item(fish_id, 1)
    var fish_data := _get_fish_data(fish_id)
    var fish_name: String = fish_data.get("name", "Fish")
    NotificationManager.show_item_obtained(fish_name, 1)
    fishing_ended.emit(fish_id)

func _on_fishing_cancelled() -> void:
    fishing_ended.emit("")

func _get_fish_data(fish_id: String) -> Dictionary:
    for fish in _fishing_data.get("fish", []):
        if fish.get("id", "") == fish_id:
            return fish
    return {}

func get_available_fish() -> Array:
    return _spot_data.get("fish_pool", [])
