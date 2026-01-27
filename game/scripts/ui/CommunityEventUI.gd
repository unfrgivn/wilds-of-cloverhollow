extends CanvasLayer
## Community event UI displaying active events and progress.

@onready var _panel: Panel = $Panel
@onready var _title_label: Label = $Panel/VBox/TitleLabel
@onready var _event_list: VBoxContainer = $Panel/VBox/ScrollContainer/EventList
@onready var _close_button: Button = $Panel/VBox/CloseButton

var _is_open: bool = false


func _ready() -> void:
    visible = false
    _close_button.pressed.connect(_on_close_pressed)
    CommunityEventManager.events_refreshed.connect(_on_events_refreshed)
    CommunityEventManager.event_progress_updated.connect(_on_progress_updated)


func _input(event: InputEvent) -> void:
    if not _is_open:
        return
    
    if event.is_action_pressed("cancel") or event.is_action_pressed("pause"):
        close()
        get_viewport().set_input_as_handled()


func open() -> void:
    _is_open = true
    visible = true
    _refresh_display()
    get_tree().paused = true


func close() -> void:
    _is_open = false
    visible = false
    get_tree().paused = false


func is_open() -> bool:
    return _is_open


func _refresh_display() -> void:
    # Clear existing entries
    for child in _event_list.get_children():
        child.queue_free()
    
    var active_events: Array = CommunityEventManager.get_active_events()
    
    if active_events.is_empty():
        var no_events_label := Label.new()
        no_events_label.text = "No active events right now.\nCheck back soon!"
        no_events_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
        _event_list.add_child(no_events_label)
        return
    
    for event in active_events:
        var entry := _create_event_entry(event)
        _event_list.add_child(entry)


func _create_event_entry(event: Dictionary) -> Control:
    var container := VBoxContainer.new()
    container.add_theme_constant_override("separation", 4)
    
    # Event name
    var name_label := Label.new()
    name_label.text = event.get("name", "Unknown Event")
    name_label.add_theme_font_size_override("font_size", 18)
    container.add_child(name_label)
    
    # Description
    var desc_label := Label.new()
    desc_label.text = event.get("description", "")
    desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    container.add_child(desc_label)
    
    # Progress bar
    var progress_container := HBoxContainer.new()
    var progress_bar := ProgressBar.new()
    progress_bar.custom_minimum_size = Vector2(200, 20)
    progress_bar.max_value = event.get("target_count", 100)
    progress_bar.value = event.get("player_progress", 0)
    progress_container.add_child(progress_bar)
    
    var progress_label := Label.new()
    progress_label.text = " %d/%d" % [event.get("player_progress", 0), event.get("target_count", 100)]
    progress_container.add_child(progress_label)
    container.add_child(progress_container)
    
    # Time remaining
    var time_label := Label.new()
    var time_remaining: int = event.get("time_remaining", 0)
    time_label.text = "Time remaining: %s" % CommunityEventManager.format_time_remaining(time_remaining)
    time_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
    container.add_child(time_label)
    
    # Buttons
    var button_container := HBoxContainer.new()
    var event_id: String = event.get("id", "")
    
    if not CommunityEventManager.is_event_joined(event_id):
        var join_button := Button.new()
        join_button.text = "Join Event"
        join_button.pressed.connect(func(): _on_join_pressed(event_id))
        button_container.add_child(join_button)
    elif event.get("player_progress", 0) >= event.get("target_count", 100):
        if not CommunityEventManager.is_reward_claimed(event_id):
            var claim_button := Button.new()
            claim_button.text = "Claim Reward!"
            claim_button.pressed.connect(func(): _on_claim_pressed(event_id))
            button_container.add_child(claim_button)
        else:
            var claimed_label := Label.new()
            claimed_label.text = "✓ Reward Claimed"
            claimed_label.add_theme_color_override("font_color", Color(0.5, 1.0, 0.5))
            button_container.add_child(claimed_label)
    else:
        var joined_label := Label.new()
        joined_label.text = "Participating"
        joined_label.add_theme_color_override("font_color", Color(0.5, 0.8, 1.0))
        button_container.add_child(joined_label)
    
    container.add_child(button_container)
    
    # Separator
    var sep := HSeparator.new()
    sep.add_theme_constant_override("separation", 8)
    container.add_child(sep)
    
    return container


func _on_join_pressed(event_id: String) -> void:
    CommunityEventManager.join_event(event_id)
    _refresh_display()


func _on_claim_pressed(event_id: String) -> void:
    var reward: Dictionary = CommunityEventManager.claim_reward(event_id)
    if not reward.is_empty():
        # Show reward notification
        if NotificationManager:
            var msg: String = "Received %d gold" % reward.get("gold", 0)
            NotificationManager.show_notification("Reward Claimed!", msg, NotificationManager.NotificationType.ACHIEVEMENT)
    _refresh_display()


func _on_close_pressed() -> void:
    close()


func _on_events_refreshed(_active_events: Array) -> void:
    if _is_open:
        _refresh_display()


func _on_progress_updated(_event_id: String, _progress: int, _target: int) -> void:
    if _is_open:
        _refresh_display()
