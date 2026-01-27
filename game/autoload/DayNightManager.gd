extends Node

## DayNightManager - Manages time of day, day of week, and visual color modulation
##
## Time phases: morning (0), afternoon (1), evening (2), night (3)
## Days: 0=Monday through 6=Sunday, with Saturday(5) and Sunday(6) being weekend
## Time advances on area transitions (simplified model)

signal time_changed(phase: int, phase_name: String)
signal day_changed(day: int, day_name: String, is_weekend: bool)

## Time phases
enum TimePhase {
	MORNING = 0,
	AFTERNOON = 1,
	EVENING = 2,
	NIGHT = 3
}

## Days of the week
enum DayOfWeek {
	MONDAY = 0,
	TUESDAY = 1,
	WEDNESDAY = 2,
	THURSDAY = 3,
	FRIDAY = 4,
	SATURDAY = 5,
	SUNDAY = 6
}

## Phase names for display
const PHASE_NAMES := ["Morning", "Afternoon", "Evening", "Night"]

## Day names for display
const DAY_NAMES := ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

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

## Current day of the week (0=Monday, 6=Sunday)
var current_day: int = DayOfWeek.MONDAY

## Transition duration in seconds
var transition_duration: float = 1.0

## The color modulation overlay
var _overlay: CanvasModulate = null

## Whether a transition is in progress
var _transitioning: bool = false

func _ready() -> void:
	_create_overlay()
	_apply_phase_color(current_phase)
	print("[DayNightManager] Initialized at %s, %s" % [get_day_name(), get_phase_name()])

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

## Get current day name
func get_day_name() -> String:
	return DAY_NAMES[current_day]

## Check if current day is a weekend (Saturday or Sunday)
func is_weekend() -> bool:
	return current_day == DayOfWeek.SATURDAY or current_day == DayOfWeek.SUNDAY

## Check if current day is a weekday
func is_weekday() -> bool:
	return not is_weekend()

## Advance to next day (wraps after Sunday)
func advance_day() -> void:
	var next_day = (current_day + 1) % DayOfWeek.size()
	set_day(next_day)

## Set specific day
func set_day(day: int, quiet: bool = false) -> void:
	if day < 0 or day >= DayOfWeek.size():
		push_warning("[DayNightManager] Invalid day: %d" % day)
		return
	
	if day == current_day:
		return
	
	var old_day = current_day
	current_day = day
	
	if not quiet:
		day_changed.emit(current_day, get_day_name(), is_weekend())
		print("[DayNightManager] Day changed: %s -> %s%s" % [DAY_NAMES[old_day], DAY_NAMES[day], " (weekend)" if is_weekend() else ""])

## Set day instantly (for scenarios/testing)
func set_day_instant(day: int) -> void:
	set_day(day, false)

## Get all available days (for iteration)
func get_all_days() -> Array[int]:
	return [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
			DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]
