class_name ScheduledNPC
extends CharacterBody2D

## ScheduledNPC - An NPC that moves between locations based on time of day and day of week
##
## Connects to DayNightManager and relocates based on schedule data
## Supports separate weekday and weekend schedules

@export var npc_id: String = ""
@export var npc_name: String = ""

## Schedule data - loaded from GameData or set via editor
var schedule: Dictionary = {}

## Current area this NPC should appear in
var _current_scheduled_area: String = ""

## Whether we're using weekend schedule
var _using_weekend_schedule: bool = false

func _ready() -> void:
	# Load schedule data if not already set
	if schedule.is_empty() and not npc_id.is_empty():
		_load_schedule()
	
	# Connect to DayNightManager
	if DayNightManager != null:
		DayNightManager.time_changed.connect(_on_time_changed)
		DayNightManager.day_changed.connect(_on_day_changed)
		# Set initial position based on current time and day
		_using_weekend_schedule = DayNightManager.is_weekend()
		_update_for_time(DayNightManager.current_phase)

func _load_schedule() -> void:
	var schedules = GameData.get_npc_schedules()
	if schedules.has(npc_id):
		schedule = schedules[npc_id]
		if schedule.has("npc_name"):
			npc_name = schedule["npc_name"]
		print("[ScheduledNPC] Loaded schedule for: %s" % npc_id)
	else:
		push_warning("[ScheduledNPC] No schedule found for: %s" % npc_id)

func _on_time_changed(phase: int, _phase_name: String) -> void:
	_update_for_time(phase)

func _on_day_changed(_day: int, _day_name: String, is_weekend: bool) -> void:
	_using_weekend_schedule = is_weekend
	_update_for_time(DayNightManager.current_phase)

func _update_for_time(phase: int) -> void:
	if schedule.is_empty():
		return
	
	# Choose weekday or weekend locations
	var locations: Dictionary = {}
	if _using_weekend_schedule and schedule.has("weekend_locations"):
		locations = schedule.get("weekend_locations", {})
	elif schedule.has("weekday_locations"):
		locations = schedule.get("weekday_locations", {})
	else:
		# Fallback to old "locations" key for backwards compatibility
		locations = schedule.get("locations", {})
	
	var phase_str := str(phase)
	
	if not locations.has(phase_str):
		# No location for this phase - hide NPC
		visible = false
		return
	
	var loc: Dictionary = locations[phase_str]
	var target_area: Variant = loc.get("area")
	var target_pos: Variant = loc.get("position")
	
	# If area is null, NPC is "away" (not visible)
	if target_area == null:
		visible = false
		_current_scheduled_area = ""
		return
	
	_current_scheduled_area = str(target_area)
	
	# Check if we're in the right area
	var current_scene := get_tree().current_scene
	if current_scene != null:
		var current_area := current_scene.scene_file_path
		if current_area == _current_scheduled_area:
			# We're in the right area - position and show
			if target_pos is Array and target_pos.size() >= 2:
				position = Vector2(target_pos[0], target_pos[1])
			visible = true
			var schedule_type := "weekend" if _using_weekend_schedule else "weekday"
			print("[ScheduledNPC] %s positioned at %s for phase %d (%s)" % [npc_id, position, phase, schedule_type])
		else:
			# Wrong area - hide
			visible = false
	else:
		visible = false

## Check if NPC should be visible in a given area
func should_be_in_area(area_path: String) -> bool:
	return _current_scheduled_area == area_path

## Get position for current time phase
func get_scheduled_position() -> Vector2:
	if schedule.is_empty():
		return position
	
	var locations: Dictionary = {}
	if _using_weekend_schedule and schedule.has("weekend_locations"):
		locations = schedule.get("weekend_locations", {})
	elif schedule.has("weekday_locations"):
		locations = schedule.get("weekday_locations", {})
	else:
		locations = schedule.get("locations", {})
	
	var phase_str := str(DayNightManager.current_phase)
	
	if locations.has(phase_str):
		var loc: Dictionary = locations[phase_str]
		var target_pos: Variant = loc.get("position")
		if target_pos is Array and target_pos.size() >= 2:
			return Vector2(target_pos[0], target_pos[1])
	
	return position

## Get weekend-specific dialogue if available
func get_weekend_dialogue() -> Array:
	if _using_weekend_schedule and schedule.has("weekend_dialogue"):
		return schedule.get("weekend_dialogue", [])
	return []

## Check if NPC has weekend dialogue
func has_weekend_dialogue() -> bool:
	return _using_weekend_schedule and schedule.has("weekend_dialogue") and not schedule.get("weekend_dialogue", []).is_empty()
