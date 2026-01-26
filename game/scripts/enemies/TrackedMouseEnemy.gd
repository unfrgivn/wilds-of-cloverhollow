extends Area2D
## TrackedMouseEnemy - Mouse enemy that tracks defeat via story flags for quest progress

signal triggered

## Mouse identifier (1, 2, or 3) for tracking
@export var mouse_id: int = 1

var _triggered: bool = false

func _ready() -> void:
	# Check if already defeated
	var flag_name := "mouse_%d_defeated" % mouse_id
	if InventoryManager.has_story_flag(flag_name):
		queue_free()
		return
	
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node) -> void:
	if body is CharacterBody2D and not _triggered:
		_triggered = true
		triggered.emit()
		print("[TrackedMouseEnemy] Player collided with mouse %d" % mouse_id)
		
		# Connect to battle ended to track victory
		BattleManager.battle_ended.connect(_on_battle_ended, CONNECT_ONE_SHOT)
		
		# Start battle via BattleManager
		var enemy_data := {
			"enemy_id": "mischief_mouse",
			"enemy_name": "Mischief Mouse"
		}
		BattleManager.start_battle(enemy_data)
		
		# Hide self during battle (will be freed or restored after)
		visible = false
		set_deferred("monitoring", false)

func _on_battle_ended(result: String) -> void:
	if result == "victory":
		var flag_name := "mouse_%d_defeated" % mouse_id
		InventoryManager.set_story_flag(flag_name, true)
		print("[TrackedMouseEnemy] Mouse %d defeated, flag set: %s" % [mouse_id, flag_name])
		
		# Check if all mice defeated
		_check_all_mice_defeated()
		
		# Remove self
		queue_free()
	else:
		# Player fled or was defeated - restore enemy
		visible = true
		set_deferred("monitoring", true)
		_triggered = false

func _check_all_mice_defeated() -> void:
	var all_defeated := true
	for i in range(1, 4):
		if not InventoryManager.has_story_flag("mouse_%d_defeated" % i):
			all_defeated = false
			break
	
	if all_defeated:
		InventoryManager.set_story_flag("all_mice_defeated", true)
		print("[TrackedMouseEnemy] All mice defeated!")
		
		# Complete objective 0 of pest_control quest if active
		if QuestManager.is_quest_active("pest_control"):
			QuestManager.complete_objective("pest_control", 0)
