extends CanvasLayer
## BugCatchingMinigame - Chase and catch bugs
## Player times their button press to catch bugs moving around the screen

signal bug_caught(bug_id: String)
signal catching_cancelled

@onready var instruction_label: Label = $Panel/InstructionLabel
@onready var result_label: Label = $Panel/ResultLabel
@onready var bug_sprite: ColorRect = $Panel/BugSprite
@onready var catch_zone: ColorRect = $Panel/CatchZone
@onready var timer_label: Label = $Panel/TimerLabel

var spawn_data: Dictionary = {}
var bug_data: Dictionary = {}

enum State { SEARCHING, CHASING, CAUGHT, ESCAPED, DONE }
var current_state: State = State.SEARCHING

var current_bug: Dictionary = {}
var bug_position: Vector2 = Vector2.ZERO
var bug_velocity: Vector2 = Vector2.ZERO
var time_remaining: float = 5.0
var catch_window: float = 0.0

var _rng: RandomNumberGenerator = RandomNumberGenerator.new()

func _ready() -> void:
    visible = false
    _rng.randomize()
    result_label.visible = false

func start_catching() -> void:
    visible = true
    get_tree().paused = true
    process_mode = Node.PROCESS_MODE_ALWAYS
    _spawn_bug()

func _spawn_bug() -> void:
    current_state = State.SEARCHING
    instruction_label.text = "A bug appeared! Get ready..."
    result_label.visible = false
    bug_sprite.visible = false
    
    # Select a random bug
    current_bug = _select_random_bug()
    
    # Wait then start chase
    await get_tree().create_timer(1.0).timeout
    _start_chase()

func _start_chase() -> void:
    current_state = State.CHASING
    var bug_name: String = current_bug.get("name", "Bug")
    instruction_label.text = "Catch the %s! Press SPACE when close!" % bug_name
    
    # Position bug randomly
    var panel_size: Vector2 = Vector2(300, 200)
    bug_position = Vector2(
        _rng.randf_range(50, panel_size.x - 50),
        _rng.randf_range(50, panel_size.y - 50)
    )
    
    # Bug speed based on difficulty
    var speed: int = current_bug.get("speed", 2)
    var base_speed: float = 30.0 + speed * 15.0
    bug_velocity = Vector2(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1)).normalized() * base_speed
    
    bug_sprite.visible = true
    bug_sprite.position = bug_position
    
    # Shorter time for faster bugs
    time_remaining = 6.0 - speed * 0.5
    catch_window = 0.4 - speed * 0.05

func _process(delta: float) -> void:
    if not visible:
        return
    
    if current_state == State.CHASING:
        _update_chase(delta)

func _update_chase(delta: float) -> void:
    time_remaining -= delta
    timer_label.text = "%.1f" % time_remaining
    
    if time_remaining <= 0:
        _bug_escaped()
        return
    
    # Move bug
    bug_position += bug_velocity * delta
    
    # Bounce off walls
    var panel_size: Vector2 = Vector2(300, 200)
    if bug_position.x < 20 or bug_position.x > panel_size.x - 20:
        bug_velocity.x *= -1
        bug_position.x = clamp(bug_position.x, 20, panel_size.x - 20)
    if bug_position.y < 20 or bug_position.y > panel_size.y - 20:
        bug_velocity.y *= -1
        bug_position.y = clamp(bug_position.y, 20, panel_size.y - 20)
    
    # Randomly change direction
    if _rng.randf() < 0.02:
        bug_velocity = bug_velocity.rotated(_rng.randf_range(-0.5, 0.5))
    
    bug_sprite.position = bug_position
    
    # Update catch zone (follows mouse or centered)
    catch_zone.position = Vector2(panel_size.x / 2 - 30, panel_size.y / 2 - 30)

func _input(event: InputEvent) -> void:
    if not visible:
        return
    
    if event.is_action_pressed("ui_cancel"):
        _cancel_catching()
        get_viewport().set_input_as_handled()
        return
    
    if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
        match current_state:
            State.CHASING:
                _attempt_catch()
            State.CAUGHT, State.ESCAPED:
                _finish()
        get_viewport().set_input_as_handled()

func _attempt_catch() -> void:
    # Check if bug is in catch zone
    var catch_center: Vector2 = catch_zone.position + catch_zone.size / 2
    var distance: float = bug_position.distance_to(catch_center)
    var catch_radius: float = 50.0
    
    if distance < catch_radius:
        _catch_success()
    else:
        # Missed - bug moves faster briefly
        bug_velocity *= 1.5
        instruction_label.text = "Missed! Try again!"
        # Reset instruction after short delay
        await get_tree().create_timer(0.3).timeout
        if current_state == State.CHASING:
            var bug_name: String = current_bug.get("name", "Bug")
            instruction_label.text = "Catch the %s! Press SPACE when close!" % bug_name

func _catch_success() -> void:
    current_state = State.CAUGHT
    var bug_name: String = current_bug.get("name", "Bug")
    result_label.text = "Caught %s!" % bug_name
    result_label.visible = true
    instruction_label.text = "Press SPACE to continue"
    bug_sprite.visible = false
    SFXManager.play("pickup")

func _bug_escaped() -> void:
    current_state = State.ESCAPED
    result_label.text = "It got away!"
    result_label.visible = true
    instruction_label.text = "Press SPACE to continue"
    bug_sprite.visible = false
    current_bug = {}

func _finish() -> void:
    get_tree().paused = false
    visible = false
    
    if current_bug.is_empty():
        catching_cancelled.emit()
    else:
        bug_caught.emit(current_bug.get("id", ""))
    
    queue_free()

func _cancel_catching() -> void:
    get_tree().paused = false
    visible = false
    catching_cancelled.emit()
    queue_free()

func _select_random_bug() -> Dictionary:
    var bug_pool: Array = spawn_data.get("bug_pool", [])
    if bug_pool.is_empty():
        return {"id": "common_butterfly", "name": "Common Butterfly", "speed": 1}
    
    var rarity_weights: Dictionary = bug_data.get("rarity_weights", {
        "common": 55,
        "uncommon": 28,
        "rare": 14,
        "legendary": 3
    })
    
    # Check time of day for valid bugs
    var current_phase: int = DayNightManager.current_phase if DayNightManager else 1
    var phase_names: Array = ["morning", "afternoon", "evening", "night"]
    var current_time_name: String = phase_names[current_phase] if current_phase < phase_names.size() else "afternoon"
    
    var weighted_pool: Array = []
    for bug_id in bug_pool:
        var bug_info := _get_bug_info(bug_id)
        if bug_info.is_empty():
            continue
        
        # Check if bug is active at current time
        var times: Array = bug_info.get("time_of_day", ["morning", "afternoon"])
        if current_time_name not in times:
            continue
        
        var rarity: String = bug_info.get("rarity", "common")
        var weight: int = rarity_weights.get(rarity, 55)
        for i in range(weight):
            weighted_pool.append(bug_info)
    
    if weighted_pool.is_empty():
        # Fallback to any bug from pool
        for bug_id in bug_pool:
            var bug_info := _get_bug_info(bug_id)
            if not bug_info.is_empty():
                return bug_info
        return {"id": "common_butterfly", "name": "Common Butterfly", "speed": 1}
    
    return weighted_pool[_rng.randi() % weighted_pool.size()]

func _get_bug_info(bug_id: String) -> Dictionary:
    for bug in bug_data.get("bugs", []):
        if bug.get("id", "") == bug_id:
            return bug
    return {}
