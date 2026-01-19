extends Node

@export var scale_presets: PackedFloat32Array = PackedFloat32Array([1.0, 0.85, 0.7])
@export var default_scale := 1.0

var render_scale := 1.0
var _preset_index := 0

func _ready() -> void:
	_parse_args()
	_apply_scale(default_scale)

func set_render_scale(scale: float) -> void:
	_apply_scale(scale)

func cycle_render_scale() -> float:
	if scale_presets.is_empty():
		return render_scale
	_preset_index = (_preset_index + 1) % scale_presets.size()
	_apply_scale(scale_presets[_preset_index])
	return render_scale

func _apply_scale(scale: float) -> void:
	render_scale = _clamp_scale(scale)
	var viewport = get_viewport()
	if viewport != null:
		viewport.scaling_3d_scale = render_scale
	if is_inside_tree():
		var game_state = get_node_or_null("/root/GameState")
		if game_state != null:
			game_state.set_value("render_scale", render_scale)

func _clamp_scale(scale: float) -> float:
	if scale_presets.is_empty():
		return clampf(scale, 0.5, 1.0)
	var bounds = _preset_bounds()
	return clampf(scale, bounds[0], bounds[1])

func _preset_bounds() -> Array:
	var min_scale = scale_presets[0]
	var max_scale = scale_presets[0]
	for value in scale_presets:
		min_scale = minf(min_scale, value)
		max_scale = maxf(max_scale, value)
	return [min_scale, max_scale]

func _parse_args() -> void:
	var args = OS.get_cmdline_user_args()
	for arg in args:
		if arg.begins_with("--render_scale="):
			default_scale = float(arg.get_slice("=", 1))
			return
