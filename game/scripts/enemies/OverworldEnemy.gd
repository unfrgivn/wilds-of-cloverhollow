extends Area2D
## OverworldEnemy - Visible enemy on the overworld that triggers battles on collision

signal triggered

## Enemy identifier for battle data
@export var enemy_id: String = "slime"
## Enemy display name
@export var enemy_name: String = "Slime"

var _triggered: bool = false

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node) -> void:
	if body is CharacterBody2D and not _triggered:
		_triggered = true
		triggered.emit()
		print("[OverworldEnemy] Player collided with %s" % enemy_name)
		
		# Start battle via BattleManager
		var enemy_data := {
			"enemy_id": enemy_id,
			"enemy_name": enemy_name
		}
		BattleManager.start_battle(enemy_data)
		
		# Remove self after triggering (enemy consumed by encounter)
		queue_free()
