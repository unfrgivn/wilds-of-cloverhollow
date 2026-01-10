extends CanvasLayer
## UIRoot - Global UI layer for dialogue, inventory, and HUD elements

signal dialogue_started
signal dialogue_finished

# UI state
var is_dialogue_active: bool = false
var is_menu_open: bool = false

# References to UI components (set when they're created/loaded)
var dialogue_box: Control = null
var inventory_panel: Control = null
var hud: Control = null


func _ready() -> void:
	# UIRoot is a CanvasLayer so it renders above the game world
	layer = 100


## Show dialogue text (simple version - will be expanded)
func show_dialogue(lines: Array[String], speaker: String = "") -> void:
	if is_dialogue_active:
		push_warning("[UIRoot] Dialogue already active")
		return
	
	is_dialogue_active = true
	dialogue_started.emit()
	
	# For now, just print to console until dialogue box is implemented
	if speaker:
		print("[%s]" % speaker)
	for line in lines:
		print("  %s" % line)
	
	# TODO: Implement actual dialogue box display
	# await dialogue_box.show_lines(lines, speaker)
	
	is_dialogue_active = false
	dialogue_finished.emit()


## Close any open dialogue
func close_dialogue() -> void:
	is_dialogue_active = false
	if dialogue_box:
		dialogue_box.visible = false
	dialogue_finished.emit()


## Toggle inventory panel
func toggle_inventory() -> void:
	if inventory_panel:
		inventory_panel.visible = not inventory_panel.visible
		is_menu_open = inventory_panel.visible


## Show a brief notification/toast message
func show_notification(message: String, duration: float = 2.0) -> void:
	print("[Notification] %s" % message)
	# TODO: Implement visual notification


## Show interaction prompt (e.g., "Press Z to talk")
func show_interaction_prompt(text: String) -> void:
	# TODO: Implement interaction prompt UI
	pass


## Hide interaction prompt
func hide_interaction_prompt() -> void:
	# TODO: Implement
	pass
