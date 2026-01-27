extends Node
## NewGamePlusManager — Handles New Game+ mode progression.
##
## Unlocked after completing the game (credits roll).
## Carries over: levels, stats, tools, key items.
## Resets: story progress, quest flags, NPC dialogue state.
## Adds: difficulty scaling for enemies.

signal ng_plus_unlocked
signal ng_plus_started(cycle: int)

# NG+ persistence file
const NG_PLUS_FILE: String = "user://ng_plus.json"

# Carried over data
var _ng_plus_unlocked: bool = false
var _ng_plus_cycle: int = 0  # 0 = normal, 1 = NG+, 2 = NG++, etc.
var _carryover_data: Dictionary = {}

# Difficulty scaling per cycle
const ENEMY_STAT_MULTIPLIER: float = 1.25  # 25% stronger per cycle
const XP_BONUS_MULTIPLIER: float = 1.1  # 10% more XP per cycle
const GOLD_BONUS_MULTIPLIER: float = 1.2  # 20% more gold per cycle


func _ready() -> void:
    _load_ng_plus_state()


## Unlock New Game+ (called after credits)
func unlock_ng_plus() -> void:
    if _ng_plus_unlocked:
        return
    _ng_plus_unlocked = true
    _save_ng_plus_state()
    ng_plus_unlocked.emit()
    print("[NewGamePlusManager] New Game+ unlocked!")


## Check if NG+ is available
func is_ng_plus_unlocked() -> bool:
    return _ng_plus_unlocked


## Get current NG+ cycle (0 = normal, 1 = NG+, 2 = NG++, etc.)
func get_ng_plus_cycle() -> int:
    return _ng_plus_cycle


## Check if currently in NG+ mode
func is_ng_plus_active() -> bool:
    return _ng_plus_cycle > 0


## Prepare carryover data from current save
func prepare_carryover() -> void:
    if not has_node("/root/InventoryManager"):
        return
    
    var inv = get_node("/root/InventoryManager")
    _carryover_data = {
        "tools": inv.get_tools().duplicate(),
        "items": inv.get_items().duplicate(),
        "cycle": _ng_plus_cycle + 1
    }
    
    # Get party stats if PartyManager exists
    if has_node("/root/PartyManager"):
        var party = get_node("/root/PartyManager")
        _carryover_data["party_levels"] = party.get_all_levels() if party.has_method("get_all_levels") else {}
    
    print("[NewGamePlusManager] Prepared carryover data for cycle %d" % _carryover_data["cycle"])


## Start New Game+ with carryover data
func start_ng_plus() -> void:
    if not _ng_plus_unlocked:
        push_warning("[NewGamePlusManager] Cannot start NG+ - not unlocked")
        return
    
    _ng_plus_cycle = _carryover_data.get("cycle", 1)
    
    # Apply carryover data
    _apply_carryover()
    
    # Save state
    _save_ng_plus_state()
    
    ng_plus_started.emit(_ng_plus_cycle)
    print("[NewGamePlusManager] Started NG+ cycle %d" % _ng_plus_cycle)


## Apply carryover data to game state
func _apply_carryover() -> void:
    if not has_node("/root/InventoryManager"):
        return
    
    var inv = get_node("/root/InventoryManager")
    
    # Restore tools
    var carried_tools: Array = _carryover_data.get("tools", [])
    for tool_id in carried_tools:
        inv.acquire_tool(tool_id)
    
    # Restore items (key items only, consumables reset)
    # Note: Full item carryover can be enabled by uncommenting below
    # var carried_items: Dictionary = _carryover_data.get("items", {})
    # for item_id in carried_items:
    #     inv.add_item(item_id, carried_items[item_id])


## Get enemy stat multiplier for current cycle
func get_enemy_multiplier() -> float:
    if _ng_plus_cycle <= 0:
        return 1.0
    return pow(ENEMY_STAT_MULTIPLIER, _ng_plus_cycle)


## Get XP bonus multiplier for current cycle
func get_xp_multiplier() -> float:
    if _ng_plus_cycle <= 0:
        return 1.0
    return pow(XP_BONUS_MULTIPLIER, _ng_plus_cycle)


## Get gold bonus multiplier for current cycle
func get_gold_multiplier() -> float:
    if _ng_plus_cycle <= 0:
        return 1.0
    return pow(GOLD_BONUS_MULTIPLIER, _ng_plus_cycle)


## Scale enemy stats for NG+
func scale_enemy_stats(base_stats: Dictionary) -> Dictionary:
    var multiplier: float = get_enemy_multiplier()
    var scaled: Dictionary = base_stats.duplicate()
    
    # Scale HP, ATK, DEF (not speed - keeps battles fair)
    if scaled.has("max_hp"):
        scaled["max_hp"] = int(scaled["max_hp"] * multiplier)
    if scaled.has("attack"):
        scaled["attack"] = int(scaled["attack"] * multiplier)
    if scaled.has("defense"):
        scaled["defense"] = int(scaled["defense"] * multiplier)
    
    return scaled


## Reset NG+ state (for testing)
func reset_ng_plus() -> void:
    _ng_plus_unlocked = false
    _ng_plus_cycle = 0
    _carryover_data = {}
    _save_ng_plus_state()
    print("[NewGamePlusManager] NG+ state reset")


func _save_ng_plus_state() -> void:
    var data: Dictionary = {
        "unlocked": _ng_plus_unlocked,
        "cycle": _ng_plus_cycle,
        "carryover": _carryover_data
    }
    var file := FileAccess.open(NG_PLUS_FILE, FileAccess.WRITE)
    if file:
        file.store_string(JSON.stringify(data))
        file.close()


func _load_ng_plus_state() -> void:
    if not FileAccess.file_exists(NG_PLUS_FILE):
        return
    var file := FileAccess.open(NG_PLUS_FILE, FileAccess.READ)
    if file:
        var json := JSON.new()
        if json.parse(file.get_as_text()) == OK:
            var data: Dictionary = json.data
            _ng_plus_unlocked = data.get("unlocked", false)
            _ng_plus_cycle = data.get("cycle", 0)
            _carryover_data = data.get("carryover", {})
        file.close()


## Get save data for persistence
func get_save_data() -> Dictionary:
    return {
        "cycle": _ng_plus_cycle
    }


## Load save data
func load_save_data(data: Dictionary) -> void:
    _ng_plus_cycle = data.get("cycle", 0)
