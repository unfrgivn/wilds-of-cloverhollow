extends Node

## DayNightManager - Manages time of day and visual color modulation
##
## Time phases: morning (0), afternoon (1), evening (2), night (3)
## Time advances on area transitions (simplified model)

signal time_changed(phase: int, phase_name: String)

## Time phases
enum TimePhase {
	MORNING = 0,
	AFTERNOON = 1,
	EVENING = 2,
	NIGHT = 3
}

## Phase names for display
const PHASE_NAMES := ["Morning", "Afternoon", "Evening", "Night"]

## Color modulation for each phase (RGBA multiplier)
## These create subtle but noticeable tinting
const PHASE_COLORS := {
	TimePhase.MORNING: Color(1.0, 0.95, 0.9, 1.0),      # Warm sunrise tint
	TimePhase.AFTERNOON: Color(1.0, 1.0, 1.0, 1.0),     # Normal daylight
	TimePhase.EVENING: Color(1.0, 0.85, 0.7, 1.0),      # Orange sunset
	TimePhase.NIGHT: Color(0.6, 0.65, 0.85, 1.0)        # Cool blue night
}

## Current time phase
var current_phase: int = TimePhase.MORNING

## Transition duration in seconds
var transition_duration: float = 1.0

## The color modulation overlay
var _overlay: CanvasModulate = null

## Whether a transition is in progress
var _transitioning: bool = false

func _ready() -> void:
	_create_overlay()
	_apply_phase_color(current_phase)
	print("[DayNightManager] Initialized at %s" % get_phase_name())

func _create_overlay() -> void:
	_overlay = CanvasModulate.new()
	_overlay.name = "DayNightOverlay"
	add_child(_overlay)

## Get current phase name
func get_phase_name() -> String:
	return PHASE_NAMES[current_phase]

## Get current phase color
func get_phase_color() -> Color:
	return PHASE_COLORS[current_phase]

## Advance time to next phase with smooth transition
func advance_time() -> void:
	var next_phase = (current_phase + 1) % TimePhase.size()
	set_time_phase(next_phase)

## Set specific time phase with smooth transition
func set_time_phase(phase: int, instant: bool = false) -> void:
	if phase < 0 or phase >= TimePhase.size():
		push_warning("[DayNightManager] Invalid phase: %d" % phase)
		return
	
	if phase == current_phase:
		return
	
	var old_phase = current_phase
	current_phase = phase
	
	if instant or transition_duration <= 0:
		_apply_phase_color(phase)
	else:
		_transition_to_color(PHASE_COLORS[old_phase], PHASE_COLORS[phase])
	
	time_changed.emit(current_phase, get_phase_name())
	print("[DayNightManager] Time changed: %s -> %s" % [PHASE_NAMES[old_phase], PHASE_NAMES[phase]])

## Apply phase color instantly
func _apply_phase_color(phase: int) -> void:
	if _overlay != null:
		_overlay.color = PHASE_COLORS[phase]

## Smooth transition between colors
func _transition_to_color(from_color: Color, to_color: Color) -> void:
	if _transitioning:
		return
	
	_transitioning = true
	
	var tween = create_tween()
	tween.tween_property(_overlay, "color", to_color, transition_duration)
	tween.finished.connect(_on_transition_finished)

func _on_transition_finished() -> void:
	_transitioning = false

## Set time instantly (for scenarios/testing)
func set_time_instant(phase: int) -> void:
	set_time_phase(phase, true)

## Get all available phases (for iteration)
func get_all_phases() -> Array[int]:
	return [TimePhase.MORNING, TimePhase.AFTERNOON, TimePhase.EVENING, TimePhase.NIGHT]
