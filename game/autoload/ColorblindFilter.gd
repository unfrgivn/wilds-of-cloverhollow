extends CanvasLayer

## ColorblindFilter - Applies colorblind accessibility shaders
## Supports deuteranopia (red-green) and protanopia (red-weak) color blindness

signal filter_changed(mode: int)

var _color_rect: ColorRect
var _shader_material: ShaderMaterial

# Shader for colorblind simulation/correction
const COLORBLIND_SHADER := """
shader_type canvas_item;

uniform int mode : hint_range(0, 2) = 0;

void fragment() {
    vec4 c = texture(TEXTURE, UV);
    
    if (mode == 1) {
        // Deuteranopia (green-weak) - shift greens to more distinguishable colors
        mat3 deuteranopia = mat3(
            vec3(0.625, 0.375, 0.0),
            vec3(0.7, 0.3, 0.0),
            vec3(0.0, 0.3, 0.7)
        );
        c.rgb = deuteranopia * c.rgb;
    } else if (mode == 2) {
        // Protanopia (red-weak) - shift reds to more distinguishable colors
        mat3 protanopia = mat3(
            vec3(0.567, 0.433, 0.0),
            vec3(0.558, 0.442, 0.0),
            vec3(0.0, 0.242, 0.758)
        );
        c.rgb = protanopia * c.rgb;
    }
    
    COLOR = c;
}
"""

func _ready() -> void:
    layer = 100  # Above everything else
    
    # Create shader
    var shader := Shader.new()
    shader.code = COLORBLIND_SHADER
    
    _shader_material = ShaderMaterial.new()
    _shader_material.shader = shader
    
    # Create fullscreen ColorRect
    _color_rect = ColorRect.new()
    _color_rect.name = "ColorblindOverlay"
    _color_rect.material = _shader_material
    _color_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    _color_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(_color_rect)
    
    # Connect to settings changes
    SettingsManager.colorblind_mode_changed.connect(_on_mode_changed)
    
    # Apply initial mode
    _apply_mode(SettingsManager.colorblind_mode)

func _on_mode_changed(mode: int) -> void:
    _apply_mode(mode)

func _apply_mode(mode: int) -> void:
    _shader_material.set_shader_parameter("mode", mode)
    _color_rect.visible = (mode != 0)
    filter_changed.emit(mode)
    print("[ColorblindFilter] Mode set to: %s" % SettingsManager.COLORBLIND_MODE_NAMES[mode])

func set_mode(mode: int) -> void:
    SettingsManager.set_colorblind_mode(mode)

func get_mode() -> int:
    return SettingsManager.colorblind_mode

func get_mode_name() -> String:
    return SettingsManager.get_colorblind_mode_name()

func cycle_mode(direction: int = 1) -> void:
    var new_mode := wrapi(SettingsManager.colorblind_mode + direction, 0, 3)
    SettingsManager.set_colorblind_mode(new_mode)
