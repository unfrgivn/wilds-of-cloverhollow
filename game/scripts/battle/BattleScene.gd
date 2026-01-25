extends Node2D
## BattleScene - Placeholder battle screen for v0

func _ready() -> void:
	print("[BattleScene] Battle scene loaded")
	# For now, auto-end battle after a short delay for testing
	# Real battles will have turn-based logic

func _input(event: InputEvent) -> void:
	# Temporary: press "interact" to flee/end battle
	if event.is_action_pressed("interact"):
		_end_battle()

func _end_battle() -> void:
	BattleManager.end_battle("flee")
