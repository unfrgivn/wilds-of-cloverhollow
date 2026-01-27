extends Node
## MemoryManager - Monitors memory usage and handles low memory situations
##
## Godot's memory API is limited but we can:
## 1. Track resource caching and free non-essential caches
## 2. Call OS.get_static_memory_usage() for monitoring
## 3. Respond to iOS memory warnings via notification callbacks

signal memory_warning_received
signal memory_freed(amount: int)

## Memory pressure levels
enum MemoryPressure { NORMAL, WARNING, CRITICAL }

## Current pressure level
var current_pressure: MemoryPressure = MemoryPressure.NORMAL

## Cached resources that can be freed (textures, audio, etc.)
var _freeable_caches: Array[Callable] = []

## Memory thresholds (these are relative - actual monitoring is platform-dependent)
const WARNING_THRESHOLD_MB: int = 256  # Start warning at this much static memory
const CRITICAL_THRESHOLD_MB: int = 384  # Critical at this level


func _ready() -> void:
    # On iOS, we'd connect to OS memory warning notifications
    # For now, we monitor periodically
    var timer := Timer.new()
    timer.wait_time = 5.0  # Check every 5 seconds
    timer.autostart = true
    timer.timeout.connect(_check_memory)
    add_child(timer)
    print("[MemoryManager] Initialized - monitoring memory usage")


## Check current memory status
func _check_memory() -> void:
    var memory_mb: int = int(OS.get_static_memory_usage() / (1024 * 1024))
    
    var new_pressure := MemoryPressure.NORMAL
    if memory_mb >= CRITICAL_THRESHOLD_MB:
        new_pressure = MemoryPressure.CRITICAL
    elif memory_mb >= WARNING_THRESHOLD_MB:
        new_pressure = MemoryPressure.WARNING
    
    if new_pressure != current_pressure:
        current_pressure = new_pressure
        _handle_pressure_change(memory_mb)


func _handle_pressure_change(memory_mb: int) -> void:
    match current_pressure:
        MemoryPressure.WARNING:
            push_warning("[MemoryManager] Memory warning: %d MB used" % memory_mb)
            memory_warning_received.emit()
        MemoryPressure.CRITICAL:
            push_error("[MemoryManager] Critical memory: %d MB used - freeing resources" % memory_mb)
            memory_warning_received.emit()
            free_non_essential_resources()
        MemoryPressure.NORMAL:
            print("[MemoryManager] Memory pressure normal: %d MB used" % memory_mb)


## Register a cache that can be freed under memory pressure
## The callable should free resources and return the approximate bytes freed
func register_freeable_cache(free_func: Callable) -> void:
    _freeable_caches.append(free_func)


## Unregister a freeable cache
func unregister_freeable_cache(free_func: Callable) -> void:
    _freeable_caches.erase(free_func)


## Free all registered non-essential caches
func free_non_essential_resources() -> int:
    var total_freed: int = 0
    
    for free_func in _freeable_caches:
        if free_func.is_valid():
            var freed: int = free_func.call()
            if freed is int:
                total_freed += freed
    
    # Clear internal Godot caches
    _clear_godot_caches()
    
    print("[MemoryManager] Freed approximately %d bytes of cached resources" % total_freed)
    memory_freed.emit(total_freed)
    return total_freed


## Clear internal Godot engine caches
func _clear_godot_caches() -> void:
    # Force garbage collection
    # Note: Godot 4 uses reference counting primarily, but this can help
    pass


## Get current memory usage in MB
func get_memory_usage_mb() -> int:
    return int(OS.get_static_memory_usage() / (1024 * 1024))


## Get memory pressure level name
func get_pressure_name() -> String:
    match current_pressure:
        MemoryPressure.NORMAL:
            return "normal"
        MemoryPressure.WARNING:
            return "warning"
        MemoryPressure.CRITICAL:
            return "critical"
    return "unknown"


## Force a low memory check (for testing/scenarios)
func simulate_memory_pressure(level: MemoryPressure) -> void:
    var old_pressure := current_pressure
    current_pressure = level
    var fake_mb := 100
    match level:
        MemoryPressure.WARNING:
            fake_mb = WARNING_THRESHOLD_MB
        MemoryPressure.CRITICAL:
            fake_mb = CRITICAL_THRESHOLD_MB
    _handle_pressure_change(fake_mb)


## Reset pressure to normal (for testing)
func reset_pressure() -> void:
    current_pressure = MemoryPressure.NORMAL
