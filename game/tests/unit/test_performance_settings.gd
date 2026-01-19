extends "res://addons/gut/test.gd"

const PERFORMANCE_SCRIPT = "res://game/autoload/PerformanceSettings.gd"

func test_clamps_render_scale_to_presets() -> void:
	var settings = load(PERFORMANCE_SCRIPT).new()
	settings.scale_presets = PackedFloat32Array([1.0, 0.8])
	assert_true(absf(settings._clamp_scale(0.6) - 0.8) < 0.0001)
	assert_true(absf(settings._clamp_scale(1.2) - 1.0) < 0.0001)
	settings.free()

func test_cycle_render_scale() -> void:
	var settings = load(PERFORMANCE_SCRIPT).new()
	settings.scale_presets = PackedFloat32Array([1.0, 0.75])
	settings._preset_index = 0
	settings.render_scale = 1.0
	assert_eq(0.75, settings.cycle_render_scale())
	assert_eq(1.0, settings.cycle_render_scale())
	settings.free()
