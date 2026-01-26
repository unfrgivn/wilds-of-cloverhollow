extends Node

## WeatherManager - Manages weather state and effects
##
## Weather types: clear, rain, storm
## Handles rain particles and thunder flash overlay

signal weather_changed(weather_type: String)

## Weather types
enum WeatherType {
	CLEAR = 0,
	RAIN = 1,
	STORM = 2
}

## Weather names for display
const WEATHER_NAMES := ["Clear", "Rain", "Storm"]

## Current weather
var current_weather: int = WeatherType.CLEAR

## Rain particle system
var _rain_particles: CPUParticles2D = null

## Thunder flash overlay
var _thunder_overlay: ColorRect = null
var _thunder_timer: Timer = null

## Rain configuration
const RAIN_AMOUNT := 200
const RAIN_LIFETIME := 2.0
const RAIN_DIRECTION := Vector2(50, 500)  # Slightly angled, mostly down

func _ready() -> void:
	_create_rain_system()
	_create_thunder_overlay()
	_apply_weather(current_weather)
	print("[WeatherManager] Initialized with %s weather" % get_weather_name())

func _create_rain_system() -> void:
	# Create a CanvasLayer for weather effects
	var weather_layer := CanvasLayer.new()
	weather_layer.name = "WeatherLayer"
	weather_layer.layer = 5  # Above game, below UI
	add_child(weather_layer)
	
	# Create rain particles
	_rain_particles = CPUParticles2D.new()
	_rain_particles.name = "RainParticles"
	_rain_particles.emitting = false
	
	# Configure rain appearance
	_rain_particles.amount = RAIN_AMOUNT
	_rain_particles.lifetime = RAIN_LIFETIME
	_rain_particles.one_shot = false
	_rain_particles.explosiveness = 0.0
	_rain_particles.randomness = 0.1
	
	# Emission shape - full screen width from top
	_rain_particles.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	_rain_particles.emission_rect_extents = Vector2(300, 10)
	_rain_particles.position = Vector2(256, -20)  # Top of screen
	
	# Movement
	_rain_particles.direction = Vector2(0.1, 1.0)  # Mostly down, slight angle
	_rain_particles.spread = 5.0
	_rain_particles.gravity = Vector2(50, 800)
	_rain_particles.initial_velocity_min = 300.0
	_rain_particles.initial_velocity_max = 400.0
	
	# Appearance - rain drops
	_rain_particles.scale_amount_min = 0.5
	_rain_particles.scale_amount_max = 1.0
	_rain_particles.color = Color(0.6, 0.7, 0.9, 0.6)  # Light blue, semi-transparent
	
	weather_layer.add_child(_rain_particles)

func _create_thunder_overlay() -> void:
	# Create thunder flash overlay
	var thunder_layer := CanvasLayer.new()
	thunder_layer.name = "ThunderLayer"
	thunder_layer.layer = 6
	add_child(thunder_layer)
	
	_thunder_overlay = ColorRect.new()
	_thunder_overlay.name = "ThunderFlash"
	_thunder_overlay.color = Color(1.0, 1.0, 1.0, 0.0)  # White, fully transparent
	_thunder_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_thunder_overlay.size = Vector2(512, 288)
	_thunder_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	thunder_layer.add_child(_thunder_overlay)
	
	# Timer for periodic thunder
	_thunder_timer = Timer.new()
	_thunder_timer.name = "ThunderTimer"
	_thunder_timer.wait_time = 8.0  # Thunder every 8 seconds in storm
	_thunder_timer.one_shot = false
	_thunder_timer.timeout.connect(_on_thunder_timeout)
	add_child(_thunder_timer)

## Get current weather name
func get_weather_name() -> String:
	return WEATHER_NAMES[current_weather]

## Set weather type
func set_weather(weather_type: int) -> void:
	if weather_type < 0 or weather_type >= WeatherType.size():
		push_warning("[WeatherManager] Invalid weather type: %d" % weather_type)
		return
	
	if weather_type == current_weather:
		return
	
	var old_weather = current_weather
	current_weather = weather_type
	_apply_weather(weather_type)
	
	weather_changed.emit(get_weather_name())
	print("[WeatherManager] Weather changed: %s -> %s" % [WEATHER_NAMES[old_weather], WEATHER_NAMES[weather_type]])

## Set weather by name
func set_weather_by_name(weather_name: String) -> void:
	var name_lower = weather_name.to_lower()
	match name_lower:
		"clear":
			set_weather(WeatherType.CLEAR)
		"rain":
			set_weather(WeatherType.RAIN)
		"storm":
			set_weather(WeatherType.STORM)
		_:
			push_warning("[WeatherManager] Unknown weather name: %s" % weather_name)

## Apply weather effects
func _apply_weather(weather_type: int) -> void:
	match weather_type:
		WeatherType.CLEAR:
			_rain_particles.emitting = false
			_thunder_timer.stop()
			_thunder_overlay.color.a = 0.0
		WeatherType.RAIN:
			_rain_particles.amount = RAIN_AMOUNT / 2  # Light rain
			_rain_particles.emitting = true
			_thunder_timer.stop()
			_thunder_overlay.color.a = 0.0
		WeatherType.STORM:
			_rain_particles.amount = RAIN_AMOUNT  # Heavy rain
			_rain_particles.emitting = true
			_thunder_timer.start()

## Thunder flash effect
func _on_thunder_timeout() -> void:
	_flash_thunder()

func _flash_thunder() -> void:
	# Quick flash sequence
	var tween = create_tween()
	tween.tween_property(_thunder_overlay, "color:a", 0.8, 0.05)
	tween.tween_property(_thunder_overlay, "color:a", 0.3, 0.1)
	tween.tween_property(_thunder_overlay, "color:a", 0.6, 0.05)
	tween.tween_property(_thunder_overlay, "color:a", 0.0, 0.3)

## Manually trigger thunder (for testing)
func trigger_thunder() -> void:
	_flash_thunder()

## Get all weather types
func get_all_weather_types() -> Array[int]:
	return [WeatherType.CLEAR, WeatherType.RAIN, WeatherType.STORM]
