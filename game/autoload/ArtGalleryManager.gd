extends Node
## Manages art gallery unlocks and viewing.

signal art_unlocked(art_id: String, art_data: Dictionary)
signal gallery_opened
signal gallery_closed

const GALLERY_DATA: Array[Dictionary] = [
    {
        "id": "concept_fae",
        "name": "Fae - Main Character",
        "category": "characters",
        "description": "Our brave hero, Fae!",
        "path": "res://docs/art/concepts/fae_concept.png",
        "unlocked_by_default": true
    },
    {
        "id": "concept_pet_cat",
        "name": "Maddie - Pet Cat",
        "category": "characters",
        "description": "Fae's loyal feline companion.",
        "path": "res://docs/art/concepts/pet_cat_concept.png",
        "unlocked_by_default": true
    },
    {
        "id": "concept_elder",
        "name": "The Elder",
        "category": "characters",
        "description": "Wise advisor of Cloverhollow.",
        "path": "res://docs/art/concepts/elder_concept.png",
        "unlock_condition": {"type": "story_flag", "flag": "talked_to_elder"}
    },
    {
        "id": "concept_chaos_lord",
        "name": "The Chaos Lord",
        "category": "characters",
        "description": "The mysterious villain behind the chaos.",
        "path": "res://docs/art/concepts/chaos_lord_concept.png",
        "unlock_condition": {"type": "story_flag", "flag": "villain_revealed"}
    },
    {
        "id": "env_cloverhollow",
        "name": "Cloverhollow Town",
        "category": "environments",
        "description": "Our cozy hometown.",
        "path": "res://docs/art/concepts/cloverhollow_town.png",
        "unlocked_by_default": true
    },
    {
        "id": "env_forest",
        "name": "Enchanted Forest",
        "category": "environments",
        "description": "The mysterious forest outside town.",
        "path": "res://docs/art/concepts/forest_concept.png",
        "unlock_condition": {"type": "story_flag", "flag": "forest_unlocked"}
    },
    {
        "id": "env_clubhouse",
        "name": "Secret Clubhouse",
        "category": "environments",
        "description": "The kids' hidden treehouse.",
        "path": "res://docs/art/concepts/clubhouse_concept.png",
        "unlock_condition": {"type": "story_flag", "flag": "clubhouse_found"}
    },
    {
        "id": "promo_key_art",
        "name": "Key Art",
        "category": "promotional",
        "description": "Official key art for Wilds of Cloverhollow.",
        "path": "res://docs/art/promo/key_art.png",
        "unlocked_by_default": true
    }
]

const CATEGORIES: Array[String] = ["characters", "environments", "promotional"]

var _unlocked_art: Array[String] = []
var _save_path: String = "user://art_gallery.json"


func _ready() -> void:
    _load_unlocks()
    _check_default_unlocks()


func _load_unlocks() -> void:
    """Load unlocked art from save file."""
    if not FileAccess.file_exists(_save_path):
        return
    
    var file := FileAccess.open(_save_path, FileAccess.READ)
    if file == null:
        return
    
    var json := JSON.new()
    var result := json.parse(file.get_as_text())
    file.close()
    
    if result == OK and json.data is Dictionary:
        var data: Dictionary = json.data
        if data.has("unlocked_art"):
            _unlocked_art.clear()
            for art_id in data["unlocked_art"]:
                _unlocked_art.append(art_id)


func _save_unlocks() -> void:
    """Save unlocked art to file."""
    var file := FileAccess.open(_save_path, FileAccess.WRITE)
    if file == null:
        return
    
    var data := {"unlocked_art": _unlocked_art}
    file.store_string(JSON.stringify(data, "\t"))
    file.close()


func _check_default_unlocks() -> void:
    """Unlock art that is unlocked by default."""
    for art in GALLERY_DATA:
        if art.get("unlocked_by_default", false):
            if art["id"] not in _unlocked_art:
                _unlocked_art.append(art["id"])
    _save_unlocks()


func get_all_art() -> Array[Dictionary]:
    """Returns all gallery art data."""
    return GALLERY_DATA


func get_art_by_category(category: String) -> Array[Dictionary]:
    """Returns art filtered by category."""
    var result: Array[Dictionary] = []
    for art in GALLERY_DATA:
        if art["category"] == category:
            result.append(art)
    return result


func get_art(art_id: String) -> Dictionary:
    """Returns specific art data."""
    for art in GALLERY_DATA:
        if art["id"] == art_id:
            return art
    return {}


func is_art_unlocked(art_id: String) -> bool:
    """Check if specific art is unlocked."""
    return art_id in _unlocked_art


func unlock_art(art_id: String) -> void:
    """Unlock a piece of art."""
    if art_id in _unlocked_art:
        return
    
    var art := get_art(art_id)
    if art.is_empty():
        return
    
    _unlocked_art.append(art_id)
    _save_unlocks()
    art_unlocked.emit(art_id, art)


func get_unlocked_art() -> Array[String]:
    """Returns list of unlocked art IDs."""
    return _unlocked_art.duplicate()


func get_unlocked_count() -> int:
    """Returns count of unlocked art."""
    return _unlocked_art.size()


func get_total_count() -> int:
    """Returns total art count."""
    return GALLERY_DATA.size()


func get_completion_percent() -> float:
    """Returns completion percentage."""
    if GALLERY_DATA.is_empty():
        return 0.0
    return float(_unlocked_art.size()) / float(GALLERY_DATA.size()) * 100.0


func check_unlock_conditions() -> void:
    """Check and unlock art based on current game state."""
    for art in GALLERY_DATA:
        if art["id"] in _unlocked_art:
            continue
        
        if not art.has("unlock_condition"):
            continue
        
        var condition: Dictionary = art["unlock_condition"]
        var should_unlock := false
        
        match condition.get("type", ""):
            "story_flag":
                if InventoryManager.has_story_flag(condition.get("flag", "")):
                    should_unlock = true
        
        if should_unlock:
            unlock_art(art["id"])


func reset_unlocks() -> void:
    """Reset all unlocks (for testing)."""
    _unlocked_art.clear()
    _save_unlocks()
    _check_default_unlocks()


# --- Save/Load ---

func get_save_data() -> Dictionary:
    """Returns data for save file."""
    return {"unlocked_art": _unlocked_art}


func load_save_data(data: Dictionary) -> void:
    """Loads data from save file."""
    if data.has("unlocked_art"):
        _unlocked_art.clear()
        for art_id in data["unlocked_art"]:
            _unlocked_art.append(art_id)
        _save_unlocks()
