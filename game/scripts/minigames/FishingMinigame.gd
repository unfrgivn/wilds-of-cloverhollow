extends CanvasLayer
## FishingMinigame - Cast and catch mechanic
## Player times their button press to catch fish

signal fish_caught(fish_id: String)
signal fishing_cancelled

@onready var power_bar: ProgressBar = $Panel/PowerBar
@onready var target_zone: ColorRect = $Panel/TargetZone
@onready var indicator: ColorRect = $Panel/Indicator
@onready var instruction_label: Label = $Panel/InstructionLabel
@onready var result_label: Label = $Panel/ResultLabel
@onready var fish_label: Label = $Panel/FishLabel

var spot_data: Dictionary = {}
var fishing_data: Dictionary = {}

enum State { CASTING, WAITING, CATCHING, RESULT }
var current_state: State = State.CASTING

var power_direction: int = 1
var power_speed: float = 100.0
var catch_window_start: float = 0.3
var catch_window_size: float = 0.25
var indicator_speed: float = 150.0
var indicator_direction: int = 1

var current_fish: Dictionary = {}
var _rng: RandomNumberGenerator = RandomNumberGenerator.new()

func _ready() -> void:
    visible = false
    _rng.randomize()
    result_label.visible = false
    fish_label.visible = false

func start_fishing() -> void:
    visible = true
    get_tree().paused = true
    process_mode = Node.PROCESS_MODE_ALWAYS
    _start_casting()

func _start_casting() -> void:
    current_state = State.CASTING
    power_bar.value = 0
    instruction_label.text = "Press SPACE to cast!"
    target_zone.visible = false
    indicator.visible = false
    result_label.visible = false
    fish_label.visible = false

func _process(delta: float) -> void:
    if not visible:
        return
    
    match current_state:
        State.CASTING:
            _update_casting(delta)
        State.WAITING:
            pass  # Wait for fish to bite
        State.CATCHING:
            _update_catching(delta)
        State.RESULT:
            pass

func _update_casting(delta: float) -> void:
    power_bar.value += power_direction * power_speed * delta
    if power_bar.value >= 100:
        power_direction = -1
    elif power_bar.value <= 0:
        power_direction = 1

func _update_catching(delta: float) -> void:
    # Move indicator back and forth
    indicator.position.x += indicator_direction * indicator_speed * delta
    var bar_width: float = power_bar.size.x
    if indicator.position.x >= bar_width - indicator.size.x:
        indicator_direction = -1
    elif indicator.position.x <= 0:
        indicator_direction = 1

func _input(event: InputEvent) -> void:
    if not visible:
        return
    
    if event.is_action_pressed("ui_cancel"):
        _cancel_fishing()
        get_viewport().set_input_as_handled()
        return
    
    if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
        match current_state:
            State.CASTING:
                _cast_line()
            State.CATCHING:
                _attempt_catch()
            State.RESULT:
                _finish()
        get_viewport().set_input_as_handled()

func _cast_line() -> void:
    var cast_power: float = power_bar.value / 100.0
    current_state = State.WAITING
    instruction_label.text = "Waiting for a bite..."
    
    # Select a random fish based on cast power and rarity
    current_fish = _select_random_fish(cast_power)
    
    # Wait for fish to bite (random delay based on cast power)
    var wait_time: float = 1.0 + (1.0 - cast_power) * 2.0 + _rng.randf() * 1.5
    await get_tree().create_timer(wait_time).timeout
    
    if current_state == State.WAITING:
        _fish_bite()

func _fish_bite() -> void:
    current_state = State.CATCHING
    instruction_label.text = "A fish is biting! Press SPACE in the zone!"
    
    # Show catch zone based on fish difficulty
    var difficulty: int = current_fish.get("difficulty", 3)
    catch_window_size = 0.35 - (difficulty * 0.04)  # Harder fish = smaller zone
    indicator_speed = 100.0 + (difficulty * 20.0)  # Harder fish = faster indicator
    
    target_zone.visible = true
    indicator.visible = true
    
    # Position the target zone
    var bar_width: float = power_bar.size.x
    catch_window_start = 0.3 + _rng.randf() * 0.3
    target_zone.position.x = catch_window_start * bar_width
    target_zone.size.x = catch_window_size * bar_width
    
    # Start indicator from left
    indicator.position.x = 0
    indicator_direction = 1

func _attempt_catch() -> void:
    var bar_width: float = power_bar.size.x
    var indicator_center: float = indicator.position.x + indicator.size.x / 2.0
    var zone_start: float = target_zone.position.x
    var zone_end: float = target_zone.position.x + target_zone.size.x
    
    if indicator_center >= zone_start and indicator_center <= zone_end:
        _catch_success()
    else:
        _catch_fail()

func _catch_success() -> void:
    current_state = State.RESULT
    var fish_name: String = current_fish.get("name", "Fish")
    result_label.text = "Caught it!"
    fish_label.text = "You caught a %s!" % fish_name
    result_label.visible = true
    fish_label.visible = true
    instruction_label.text = "Press SPACE to continue"
    target_zone.visible = false
    indicator.visible = false
    SFXManager.play("pickup")

func _catch_fail() -> void:
    current_state = State.RESULT
    result_label.text = "It got away!"
    fish_label.text = "Better luck next time..."
    result_label.visible = true
    fish_label.visible = true
    instruction_label.text = "Press SPACE to continue"
    target_zone.visible = false
    indicator.visible = false
    current_fish = {}  # Clear the fish - nothing caught

func _finish() -> void:
    get_tree().paused = false
    visible = false
    
    if current_fish.is_empty():
        fishing_cancelled.emit()
    else:
        fish_caught.emit(current_fish.get("id", ""))
    
    queue_free()

func _cancel_fishing() -> void:
    get_tree().paused = false
    visible = false
    fishing_cancelled.emit()
    queue_free()

func _select_random_fish(cast_power: float) -> Dictionary:
    var fish_pool: Array = spot_data.get("fish_pool", [])
    if fish_pool.is_empty():
        return {"id": "common_carp", "name": "Common Carp", "difficulty": 1}
    
    # Build weighted pool based on rarity
    var rarity_weights: Dictionary = fishing_data.get("rarity_weights", {
        "common": 60,
        "uncommon": 25,
        "rare": 12,
        "legendary": 3
    })
    
    # Better cast power = slightly better odds for rare fish
    var power_bonus: float = cast_power * 0.5
    
    var weighted_pool: Array = []
    for fish_id in fish_pool:
        var fish_data := _get_fish_data(fish_id)
        if fish_data.is_empty():
            continue
        var rarity: String = fish_data.get("rarity", "common")
        var weight: int = rarity_weights.get(rarity, 60)
        # Add power bonus for rare fish
        if rarity == "rare" or rarity == "legendary":
            weight = int(weight * (1.0 + power_bonus))
        for i in range(weight):
            weighted_pool.append(fish_data)
    
    if weighted_pool.is_empty():
        return {"id": "common_carp", "name": "Common Carp", "difficulty": 1}
    
    return weighted_pool[_rng.randi() % weighted_pool.size()]

func _get_fish_data(fish_id: String) -> Dictionary:
    for fish in fishing_data.get("fish", []):
        if fish.get("id", "") == fish_id:
            return fish
    return {}
