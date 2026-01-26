extends CanvasLayer

## BookLookupUI - Stub for book lookup system (placeholder)
## Future: Will allow searching library catalogue by topic

signal lookup_closed

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var status_label: Label = $Panel/StatusLabel
@onready var instructions_label: Label = $Panel/InstructionsLabel

func _ready() -> void:
	add_to_group("book_lookup_ui")
	visible = false

func _input(event: InputEvent) -> void:
	if not visible:
		return
	
	if event.is_action_pressed("ui_cancel"):
		close_lookup()
		get_viewport().set_input_as_handled()

func open_lookup() -> void:
	visible = true
	print("[BookLookupUI] Opened")

func close_lookup() -> void:
	visible = false
	lookup_closed.emit()
	print("[BookLookupUI] Closed")
