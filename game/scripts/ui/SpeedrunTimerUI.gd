extends CanvasLayer
## SpeedrunTimerUI - Displays the speedrun timer and splits in the top corner.

@onready var timer_label: Label = $Panel/VBox/TimerLabel
@onready var splits_container: VBoxContainer = $Panel/VBox/SplitsContainer

var _visible_when_enabled: bool = true


func _ready() -> void:
    layer = 50
    visible = false
    # Connect to speedrun mode changes
    SettingsManager.speedrun_mode_changed.connect(_on_speedrun_mode_changed)
    SpeedrunManager.timer_started.connect(_on_timer_started)
    SpeedrunManager.timer_stopped.connect(_on_timer_stopped)
    SpeedrunManager.timer_reset.connect(_on_timer_reset)
    SpeedrunManager.split_recorded.connect(_on_split_recorded)
    # Show if already enabled
    if SettingsManager.speedrun_mode_enabled:
        visible = true


func _process(_delta: float) -> void:
    if visible and SpeedrunManager.is_running:
        _update_timer_display()


func _update_timer_display() -> void:
    if timer_label:
        timer_label.text = SpeedrunManager.format_time(SpeedrunManager.elapsed_time)


func _on_speedrun_mode_changed(enabled: bool) -> void:
    visible = enabled and _visible_when_enabled
    if not enabled:
        _clear_splits()


func _on_timer_started() -> void:
    _clear_splits()
    _update_timer_display()


func _on_timer_stopped(_total_time: float) -> void:
    _update_timer_display()


func _on_timer_reset() -> void:
    if timer_label:
        timer_label.text = "00:00.000"
    _clear_splits()


func _on_split_recorded(split_name: String, time: float) -> void:
    if splits_container:
        var split_label := Label.new()
        split_label.text = "%s: %s" % [split_name, SpeedrunManager.format_time(time)]
        split_label.add_theme_font_size_override("font_size", 8)
        splits_container.add_child(split_label)


func _clear_splits() -> void:
    if splits_container:
        for child in splits_container.get_children():
            child.queue_free()


func show_timer() -> void:
    _visible_when_enabled = true
    if SettingsManager.speedrun_mode_enabled:
        visible = true


func hide_timer() -> void:
    _visible_when_enabled = false
    visible = false
