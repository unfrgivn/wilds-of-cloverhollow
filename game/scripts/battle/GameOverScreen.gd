extends CanvasLayer
## GameOverScreen - Post-battle defeat screen

signal retry_pressed
signal return_to_title_pressed

## UI refs
@onready var retry_button: Button = $Panel/VBox/RetryButton
@onready var title_button: Button = $Panel/VBox/TitleButton

func _ready() -> void:
	visible = false
	if retry_button:
		retry_button.pressed.connect(_on_retry_pressed)
	if title_button:
		title_button.pressed.connect(_on_title_pressed)

## Show game over screen
func show_game_over() -> void:
	visible = true
	print("[GameOverScreen] Game Over displayed")

func _on_retry_pressed() -> void:
	visible = false
	retry_pressed.emit()

func _on_title_pressed() -> void:
	visible = false
	return_to_title_pressed.emit()

func _input(event: InputEvent) -> void:
	if not visible:
		return
	# Default to retry on accept
	if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept"):
		_on_retry_pressed()
