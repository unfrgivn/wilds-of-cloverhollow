extends Node
## CollectionLogManager - Tracks collectibles (fish, bugs) with completion milestones

signal collection_updated(category_id: String)
signal milestone_reached(category_id: String, percent: int, reward_gold: int)
signal overall_milestone_reached(percent: int, reward_gold: int)

const SAVE_PATH := "user://collection_log.json"

var _collection_data: Dictionary = {}
var _collected: Dictionary = {}  # {category_id: {item_id: count}}
var _claimed_milestones: Dictionary = {}  # {category_id: [percent_values]}
var _claimed_overall_milestones: Array = []

func _ready() -> void:
    _load_collection_data()
    _load_progress()

func _load_collection_data() -> void:
    var file := FileAccess.open("res://game/data/collections/collections.json", FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            _collection_data = json.data
    else:
        push_warning("[CollectionLogManager] Could not load collection data")

func _load_progress() -> void:
    var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            var data: Dictionary = json.data
            _collected = data.get("collected", {})
            _claimed_milestones = data.get("claimed_milestones", {})
            _claimed_overall_milestones = data.get("claimed_overall_milestones", [])

func save_progress() -> void:
    var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
    if file:
        var data := {
            "collected": _collected,
            "claimed_milestones": _claimed_milestones,
            "claimed_overall_milestones": _claimed_overall_milestones
        }
        file.store_string(JSON.stringify(data, "  "))
        file.close()

# ---- Public API ----

func get_categories() -> Array:
    return _collection_data.get("categories", [])

func get_category_items(category_id: String) -> Array:
    ## Returns all possible items in a category from the source data
    var categories: Array = get_categories()
    for cat in categories:
        if cat.get("id") == category_id:
            var source: String = cat.get("data_source", "")
            var key: String = cat.get("data_key", "")
            return _get_items_from_source(source, key)
    return []

func _get_items_from_source(source: String, key: String) -> Array:
    var path := "res://game/data/%s/%s.json" % [source, source]
    var file := FileAccess.open(path, FileAccess.READ)
    if file:
        var json := JSON.new()
        var error := json.parse(file.get_as_text())
        file.close()
        if error == OK:
            return json.data.get(key, [])
    return []

func record_collection(category_id: String, item_id: String, count: int = 1) -> void:
    ## Record that an item was collected
    if not _collected.has(category_id):
        _collected[category_id] = {}
    
    var cat_collected: Dictionary = _collected[category_id]
    if not cat_collected.has(item_id):
        cat_collected[item_id] = 0
    cat_collected[item_id] += count
    
    collection_updated.emit(category_id)
    _check_milestones(category_id)
    _check_overall_milestones()
    save_progress()

func get_collected_count(category_id: String) -> int:
    ## Returns number of unique items collected in category
    if not _collected.has(category_id):
        return 0
    return _collected[category_id].size()

func get_total_count(category_id: String) -> int:
    ## Returns total possible items in category
    return get_category_items(category_id).size()

func get_completion_percent(category_id: String) -> float:
    var total := get_total_count(category_id)
    if total == 0:
        return 0.0
    return (float(get_collected_count(category_id)) / float(total)) * 100.0

func is_item_collected(category_id: String, item_id: String) -> bool:
    if not _collected.has(category_id):
        return false
    return _collected[category_id].has(item_id)

func get_item_collected_count(category_id: String, item_id: String) -> int:
    if not _collected.has(category_id):
        return 0
    return _collected[category_id].get(item_id, 0)

func get_overall_completion_percent() -> float:
    var total_collected := 0
    var total_possible := 0
    for cat in get_categories():
        var cat_id: String = cat.get("id", "")
        total_collected += get_collected_count(cat_id)
        total_possible += get_total_count(cat_id)
    if total_possible == 0:
        return 0.0
    return (float(total_collected) / float(total_possible)) * 100.0

func get_milestones() -> Array:
    return _collection_data.get("milestones", [])

func is_milestone_claimed(category_id: String, percent: int) -> bool:
    if not _claimed_milestones.has(category_id):
        return false
    return percent in _claimed_milestones[category_id]

func is_overall_milestone_claimed(percent: int) -> bool:
    return percent in _claimed_overall_milestones

func claim_milestone(category_id: String, percent: int) -> Dictionary:
    ## Claims a category milestone reward. Returns the reward or empty if already claimed.
    if is_milestone_claimed(category_id, percent):
        return {}
    
    var milestones := get_milestones()
    for ms in milestones:
        if ms.get("percent") == percent:
            if not _claimed_milestones.has(category_id):
                _claimed_milestones[category_id] = []
            _claimed_milestones[category_id].append(percent)
            save_progress()
            milestone_reached.emit(category_id, percent, ms.get("reward_gold", 0))
            return ms
    return {}

func claim_overall_milestone(percent: int) -> Dictionary:
    ## Claims an overall milestone reward. Returns the reward or empty if already claimed.
    if is_overall_milestone_claimed(percent):
        return {}
    
    var milestones := get_milestones()
    for ms in milestones:
        if ms.get("percent") == percent:
            _claimed_overall_milestones.append(percent)
            save_progress()
            overall_milestone_reached.emit(percent, ms.get("reward_gold", 0))
            return ms
    return {}

func get_claimable_milestones(category_id: String) -> Array:
    ## Returns array of milestone percents that are reached but not claimed
    var result: Array = []
    var completion := get_completion_percent(category_id)
    for ms in get_milestones():
        var percent: int = ms.get("percent", 0)
        if completion >= percent and not is_milestone_claimed(category_id, percent):
            result.append(percent)
    return result

func get_claimable_overall_milestones() -> Array:
    var result: Array = []
    var completion := get_overall_completion_percent()
    for ms in get_milestones():
        var percent: int = ms.get("percent", 0)
        if completion >= percent and not is_overall_milestone_claimed(percent):
            result.append(percent)
    return result

func _check_milestones(category_id: String) -> void:
    var claimable := get_claimable_milestones(category_id)
    for percent in claimable:
        # Auto-emit signal but don't auto-claim (player must open UI)
        pass

func _check_overall_milestones() -> void:
    var claimable := get_claimable_overall_milestones()
    for percent in claimable:
        pass

# ---- Save/Load Integration ----

func get_save_data() -> Dictionary:
    return {
        "collected": _collected.duplicate(true),
        "claimed_milestones": _claimed_milestones.duplicate(true),
        "claimed_overall_milestones": _claimed_overall_milestones.duplicate()
    }

func load_save_data(data: Dictionary) -> void:
    _collected = data.get("collected", {})
    _claimed_milestones = data.get("claimed_milestones", {})
    _claimed_overall_milestones = data.get("claimed_overall_milestones", [])

func reset_progress() -> void:
    _collected.clear()
    _claimed_milestones.clear()
    _claimed_overall_milestones.clear()
    save_progress()
