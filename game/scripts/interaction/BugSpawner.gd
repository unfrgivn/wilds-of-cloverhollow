extends Area2D
## BugSpawner - Spawns collectible bugs in grass areas
## Player can interact to catch bugs if they have the bug net

@export var spawn_area_id: String = "town_park_grass"
@export var max_bugs: int = 3
@export var spawn_interval: float = 10.0
@export var dialogue_no_net: String = "You see some bugs, but you need a net to catch them."

signal bug_caught(bug_id: String)

const BUG_CATCHING_SCENE := preload("res://game/scenes/minigames/BugCatchingMinigame.tscn")

var _bug_data: Dictionary = {}
var _spawn_data: Dictionary = {}
var _spawned_bugs: Array = []
var _spawn_timer: float = 0.0

func _ready() -> void:
    _load_bug_data()

func _load_bug_data() -> void:
    var file := FileAccess.open("res://game/data/bugs/bugs.json", FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            _bug_data = json.data
            for area in _bug_data.get("spawn_areas", []):
                if area.get("id", "") == spawn_area_id:
                    _spawn_data = area
                    break
    else:
        push_warning("[BugSpawner] Could not load bug data")

func interact() -> void:
    if not InventoryManager.has_tool("bug_net"):
        DialogueManager.show_dialogue(dialogue_no_net)
        return
    
    _start_catching()

func _start_catching() -> void:
    var minigame: CanvasLayer = BUG_CATCHING_SCENE.instantiate()
    minigame.spawn_data = _spawn_data
    minigame.bug_data = _bug_data
    minigame.bug_caught.connect(_on_bug_caught)
    get_tree().root.add_child(minigame)
    minigame.start_catching()

func _on_bug_caught(bug_id: String) -> void:
    if bug_id.is_empty():
        return
    InventoryManager.add_item(bug_id, 1)
    var bug_info := _get_bug_info(bug_id)
    var bug_name: String = bug_info.get("name", "Bug")
    NotificationManager.show_item_obtained(bug_name, 1)
    bug_caught.emit(bug_id)

func _get_bug_info(bug_id: String) -> Dictionary:
    for bug in _bug_data.get("bugs", []):
        if bug.get("id", "") == bug_id:
            return bug
    return {}

func get_available_bugs() -> Array:
    return _spawn_data.get("bug_pool", [])
