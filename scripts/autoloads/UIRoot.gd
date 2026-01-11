extends CanvasLayer
## UIRoot - Global UI layer for dialogue, inventory, and HUD elements

signal dialogue_started
signal dialogue_finished

# UI state
var is_dialogue_active: bool = false
var is_menu_open: bool = false

# References to UI components (use Node to avoid class_name load order issues)
var _dialogue_box: Node = null
var _fade_overlay: ColorRect = null
var inventory_panel: Control = null
var hud: Control = null


func _ready() -> void:
	layer = 100
	_setup_fade_overlay()
	_setup_dialogue_box()


func _setup_fade_overlay() -> void:
	_fade_overlay = ColorRect.new()
	_fade_overlay.name = "FadeOverlay"
	_fade_overlay.color = Color.BLACK
	_fade_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_overlay.visible = false
	add_child(_fade_overlay)
	# Register with SceneRouter
	SceneRouter.set_fade_overlay(_fade_overlay)


func _setup_dialogue_box() -> void:
	var scene := load("res://scenes/ui/DialogueBox.tscn") as PackedScene
	_dialogue_box = scene.instantiate()
	add_child(_dialogue_box)
	_dialogue_box.dialogue_finished.connect(_on_dialogue_finished)


## Show dialogue text
func show_dialogue(lines: Array[String], speaker: String = "") -> void:
	if is_dialogue_active:
		push_warning("[UIRoot] Dialogue already active")
		return
	
	is_dialogue_active = true
	dialogue_started.emit()
	_dialogue_box.show_dialogue(lines, speaker)


func _on_dialogue_finished() -> void:
	is_dialogue_active = false
	dialogue_finished.emit()


## Close any open dialogue
func close_dialogue() -> void:
	if _dialogue_box:
		_dialogue_box.close_dialogue()


## Toggle inventory panel
func toggle_inventory() -> void:
	if inventory_panel:
		inventory_panel.visible = not inventory_panel.visible
		is_menu_open = inventory_panel.visible


## Show a brief notification/toast message
func show_notification(message: String, _duration: float = 2.0) -> void:
	print("[Notification] %s" % message)
	# TODO: Implement visual notification


## Show interaction prompt (e.g., "Press Z to talk")
func show_interaction_prompt(text: String) -> void:
	if _dialogue_box:
		_dialogue_box.show_prompt(text)


## Hide interaction prompt
func hide_interaction_prompt() -> void:
	if _dialogue_box:
		_dialogue_box.hide_prompt()
