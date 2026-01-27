extends Node
## InputDebouncer - Global input cooldown manager to prevent spam clicks
## 
## Usage:
##   if InputDebouncer.can_act("dialogue"):
##       InputDebouncer.mark_acted("dialogue")
##       # handle input

## Cooldown tracking per context
var _cooldowns: Dictionary = {}

## Default cooldown in seconds
const DEFAULT_COOLDOWN := 0.15

## Minimum time between rapid inputs (frames at 60fps)
const MIN_FRAMES := 9  # ~150ms at 60fps

## Frame counter for frame-based debouncing
var _frame_markers: Dictionary = {}


## Check if action is allowed in a given context
func can_act(context: String = "default") -> bool:
    # Check time-based cooldown
    if _cooldowns.has(context):
        if Time.get_ticks_msec() - _cooldowns[context] < DEFAULT_COOLDOWN * 1000:
            return false
    
    # Check frame-based cooldown
    var current_frame := Engine.get_process_frames()
    if _frame_markers.has(context):
        if current_frame - _frame_markers[context] < MIN_FRAMES:
            return false
    
    return true


## Mark that an action was taken in a context
func mark_acted(context: String = "default") -> void:
    _cooldowns[context] = Time.get_ticks_msec()
    _frame_markers[context] = Engine.get_process_frames()


## Combined check and mark - returns true if action is allowed and marks it
func try_act(context: String = "default") -> bool:
    if can_act(context):
        mark_acted(context)
        return true
    return false


## Clear cooldown for a context (e.g., when changing UI state)
func clear_cooldown(context: String = "default") -> void:
    _cooldowns.erase(context)
    _frame_markers.erase(context)


## Clear all cooldowns
func clear_all() -> void:
    _cooldowns.clear()
    _frame_markers.clear()


## Get remaining cooldown time in milliseconds (for debugging)
func get_remaining_cooldown(context: String = "default") -> float:
    if not _cooldowns.has(context):
        return 0.0
    var elapsed: int = Time.get_ticks_msec() - _cooldowns[context]
    var remaining: float = (DEFAULT_COOLDOWN * 1000) - elapsed
    return max(0.0, remaining)
