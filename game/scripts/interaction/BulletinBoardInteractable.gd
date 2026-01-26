class_name BulletinBoardInteractable
extends Area2D

## BulletinBoardInteractable - Opens the QuestUI when interacted with

signal interaction_started
signal interaction_ended

## Reference to QuestUI (will be found or created)
var _quest_ui: CanvasLayer = null

func _ready() -> void:
	pass

func interact() -> void:
	interaction_started.emit()
	_open_quest_ui()

func _open_quest_ui() -> void:
	# Find existing QuestUI or create one
	var existing_ui = get_tree().get_first_node_in_group("quest_ui")
	if existing_ui != null:
		_quest_ui = existing_ui
	else:
		# Load the QuestUI scene
		var quest_ui_scene = load("res://game/scenes/ui/QuestUI.tscn")
		if quest_ui_scene != null:
			_quest_ui = quest_ui_scene.instantiate()
			get_tree().root.add_child(_quest_ui)
		else:
			push_error("[BulletinBoardInteractable] Could not load QuestUI scene")
			return
	
	# Connect to the closed signal if not already connected
	if not _quest_ui.is_connected("ui_closed", _on_quest_ui_closed):
		_quest_ui.ui_closed.connect(_on_quest_ui_closed)
	
	# Open the UI with available quests
	var available_quests = GameData.get_available_quests()
	_quest_ui.open_quest_board(available_quests)

func _on_quest_ui_closed() -> void:
	interaction_ended.emit()

func end_interaction() -> void:
	interaction_ended.emit()
