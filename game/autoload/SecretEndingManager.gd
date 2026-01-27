extends Node
## SecretEndingManager — Tracks conditions for secret/alternate endings.
##
## The secret "redemption" ending unlocks when:
## 1. Player completed all villain backstory quests (found hope_pendant)
## 2. Player spared the villain in final battle (chose redemption dialogue)

# Secret ending condition flags
const SECRET_CONDITIONS: Array[String] = [
    "chaos_origins_discovered",
    "chaos_betrayal_learned",
    "chaos_redemption_found",
    "villain_spared"
]

signal secret_ending_unlocked
signal secret_condition_met(condition: String)

func _ready() -> void:
    # Connect to story flag changes if InventoryManager is available
    if has_node("/root/InventoryManager"):
        var inv = get_node("/root/InventoryManager")
        if inv.has_signal("story_flag_set"):
            inv.story_flag_set.connect(_on_story_flag_set)


func _on_story_flag_set(flag: String, _value: bool) -> void:
    if flag in SECRET_CONDITIONS:
        secret_condition_met.emit(flag)
        if is_secret_ending_available():
            secret_ending_unlocked.emit()


## Check if a specific secret condition is met
func is_condition_met(condition: String) -> bool:
    if not has_node("/root/InventoryManager"):
        return false
    var inv = get_node("/root/InventoryManager")
    return inv.has_story_flag(condition)


## Get all conditions and their status
func get_conditions_status() -> Dictionary:
    var status: Dictionary = {}
    for condition in SECRET_CONDITIONS:
        status[condition] = is_condition_met(condition)
    return status


## Count how many conditions are met
func get_conditions_met_count() -> int:
    var count: int = 0
    for condition in SECRET_CONDITIONS:
        if is_condition_met(condition):
            count += 1
    return count


## Check if all conditions for secret ending are met
func is_secret_ending_available() -> bool:
    for condition in SECRET_CONDITIONS:
        if not is_condition_met(condition):
            return false
    return true


## Get the ending type based on conditions
## Returns: "normal", "redemption" (secret), or "partial"
func get_ending_type() -> String:
    if is_secret_ending_available():
        return "redemption"
    elif get_conditions_met_count() >= 3:
        return "partial"
    else:
        return "normal"


## Get a description of the current ending path
func get_ending_description() -> String:
    var ending_type: String = get_ending_type()
    match ending_type:
        "redemption":
            return "The hope pendant glows... Cedric can be saved."
        "partial":
            return "You learned much about Cedric, but something is missing..."
        "normal":
            return "The Chaos Lord must be stopped."
    return ""


## Check if the player has the hope pendant (key item for redemption)
func has_hope_pendant() -> bool:
    if not has_node("/root/InventoryManager"):
        return false
    var inv = get_node("/root/InventoryManager")
    return inv.has_tool("hope_pendant")


## Trigger the spare action (called during final battle choice)
func spare_villain() -> void:
    if not has_node("/root/InventoryManager"):
        return
    var inv = get_node("/root/InventoryManager")
    inv.set_story_flag("villain_spared", true)


## Get save data for persistence
func get_save_data() -> Dictionary:
    return {}  # All data is stored in story flags via InventoryManager


## Load save data
func load_save_data(_data: Dictionary) -> void:
    pass  # All data is stored in story flags via InventoryManager
