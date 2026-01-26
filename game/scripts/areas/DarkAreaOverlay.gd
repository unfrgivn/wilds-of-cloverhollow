extends CanvasModulate
## Dark area overlay that fades when player has lantern.
## Attach to CanvasModulate node. Checks for lantern on ready and area entry.

@export var dark_color: Color = Color(0.1, 0.1, 0.15, 1.0)
@export var lit_color: Color = Color(1.0, 1.0, 1.0, 1.0)
@export var fade_duration: float = 0.5

var _is_lit: bool = false


func _ready() -> void:
    color = dark_color
    _check_lantern()


func _check_lantern() -> void:
    # Check if player has lantern and fade darkness if so
    if InventoryManager.has_tool(InventoryManager.TOOL_LANTERN):
        _light_area()
    else:
        _darken_area()


func _light_area() -> void:
    if _is_lit:
        return
    _is_lit = true
    var tween := create_tween()
    tween.tween_property(self, "color", lit_color, fade_duration)


func _darken_area() -> void:
    if not _is_lit:
        return
    _is_lit = false
    var tween := create_tween()
    tween.tween_property(self, "color", dark_color, fade_duration)


## Call this when player acquires lantern mid-scene
func on_lantern_acquired() -> void:
    _light_area()
