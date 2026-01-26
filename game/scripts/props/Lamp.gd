class_name Lamp
extends Sprite2D

## Lamp - A streetlight that turns on/off based on time of day
##
## Connects to DayNightManager and toggles between on/off sprites

@export var lamp_on_texture: Texture2D
@export var lamp_off_texture: Texture2D

## Light turns on at evening and night (phases 2 and 3)
const ON_PHASES := [2, 3]  # Evening, Night

func _ready() -> void:
	# Connect to DayNightManager if available
	if DayNightManager != null:
		DayNightManager.time_changed.connect(_on_time_changed)
		# Set initial state based on current time
		_update_lamp_state(DayNightManager.current_phase)

func _on_time_changed(phase: int, _phase_name: String) -> void:
	_update_lamp_state(phase)

func _update_lamp_state(phase: int) -> void:
	var should_be_on := phase in ON_PHASES
	
	if should_be_on and lamp_on_texture != null:
		texture = lamp_on_texture
	elif not should_be_on and lamp_off_texture != null:
		texture = lamp_off_texture
