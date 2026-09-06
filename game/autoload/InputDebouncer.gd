extends Node
## InputDebouncer - Global input cooldown manager to prevent spam clicks
## 
## Usage:
##   if InputDebouncer.can_act("dialogue"):
##       InputDebouncer.mark_acted("dialogue")
##       # handle input

## Default cooldown in seconds, converted to physics ticks at runtime.
const DEFAULT_COOLDOWN_SECONDS := 0.15

## Frame counter for frame-based debouncing
var _frame_markers: Dictionary = {}


## Check if action is allowed in a given context
func can_act(context: String = "default") -> bool:
    var current_frame := Engine.get_process_frames()
    if _frame_markers.has(context):
        if current_frame - _frame_markers[context] < _cooldown_ticks():
            return false
    
    return true


## Mark that an action was taken in a context
func mark_acted(context: String = "default") -> void:
    _frame_markers[context] = Engine.get_process_frames()


## Combined check and mark - returns true if action is allowed and marks it
func try_act(context: String = "default") -> bool:
    if can_act(context):
        mark_acted(context)
        return true
    return false


## Clear cooldown for a context (e.g., when changing UI state)
func clear_cooldown(context: String = "default") -> void:
    _frame_markers.erase(context)


## Clear all cooldowns
func clear_all() -> void:
    _frame_markers.clear()


## Get remaining cooldown time in milliseconds (for debugging)
func get_remaining_cooldown(context: String = "default") -> float:
    if not _frame_markers.has(context):
        return 0.0
    var elapsed_ticks: int = Engine.get_process_frames() - _frame_markers[context]
    var remaining_ticks: int = max(0, _cooldown_ticks() - elapsed_ticks)
    return float(remaining_ticks) * 1000.0 / float(Engine.physics_ticks_per_second)

func _cooldown_ticks() -> int:
    return maxi(1, ceili(DEFAULT_COOLDOWN_SECONDS * float(Engine.physics_ticks_per_second)))
