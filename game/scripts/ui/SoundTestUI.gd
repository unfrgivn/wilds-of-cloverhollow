extends CanvasLayer
## Sound test/jukebox UI for playing music and sound effects.

signal sound_test_closed

const MUSIC_TRACKS: Array[Dictionary] = [
    {"id": "title", "name": "Title Theme"},
    {"id": "town", "name": "Cloverhollow Town"},
    {"id": "home", "name": "Cozy Home"},
    {"id": "school", "name": "School Days"},
    {"id": "forest", "name": "Forest Adventure"},
    {"id": "battle", "name": "Battle Theme"},
    {"id": "boss", "name": "Boss Battle"},
    {"id": "victory", "name": "Victory Fanfare"},
    {"id": "credits", "name": "Credits Roll"},
]

const SFX_LIST: Array[Dictionary] = [
    {"id": "menu_move", "name": "Menu Move"},
    {"id": "menu_select", "name": "Menu Select"},
    {"id": "menu_cancel", "name": "Menu Cancel"},
    {"id": "attack_hit", "name": "Attack Hit"},
    {"id": "attack_miss", "name": "Attack Miss"},
    {"id": "defend", "name": "Defend"},
    {"id": "victory", "name": "Victory"},
    {"id": "dialogue_open", "name": "Dialogue Open"},
    {"id": "item_pickup", "name": "Item Pickup"},
]

var _panel: PanelContainer
var _tab_buttons: HBoxContainer
var _music_button: Button
var _sfx_button: Button
var _track_list: VBoxContainer
var _now_playing_label: Label
var _close_button: Button
var _showing_music: bool = true
var _selected_index: int = 0


func _ready() -> void:
    layer = 100
    process_mode = Node.PROCESS_MODE_ALWAYS
    add_to_group("sound_test_ui")
    _build_ui()
    _populate_tracks()


func _build_ui() -> void:
    # Background
    var bg = ColorRect.new()
    bg.color = Color(0.0, 0.0, 0.0, 0.7)
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(bg)
    
    # Main panel
    _panel = PanelContainer.new()
    _panel.set_anchors_preset(Control.PRESET_CENTER)
    _panel.position = Vector2(256, 144)
    _panel.custom_minimum_size = Vector2(350, 200)
    add_child(_panel)
    
    var margin = MarginContainer.new()
    margin.add_theme_constant_override("margin_left", 15)
    margin.add_theme_constant_override("margin_right", 15)
    margin.add_theme_constant_override("margin_top", 15)
    margin.add_theme_constant_override("margin_bottom", 15)
    _panel.add_child(margin)
    
    var vbox = VBoxContainer.new()
    vbox.add_theme_constant_override("separation", 10)
    margin.add_child(vbox)
    
    # Title
    var title = Label.new()
    title.text = "🎵 Sound Test"
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    title.add_theme_font_size_override("font_size", 16)
    vbox.add_child(title)
    
    # Tab buttons
    _tab_buttons = HBoxContainer.new()
    _tab_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
    _tab_buttons.add_theme_constant_override("separation", 10)
    vbox.add_child(_tab_buttons)
    
    _music_button = Button.new()
    _music_button.text = "Music"
    _music_button.pressed.connect(_on_music_tab)
    _tab_buttons.add_child(_music_button)
    
    _sfx_button = Button.new()
    _sfx_button.text = "SFX"
    _sfx_button.pressed.connect(_on_sfx_tab)
    _tab_buttons.add_child(_sfx_button)
    
    # Track list scroll
    var scroll = ScrollContainer.new()
    scroll.custom_minimum_size = Vector2(300, 100)
    vbox.add_child(scroll)
    
    _track_list = VBoxContainer.new()
    _track_list.add_theme_constant_override("separation", 5)
    scroll.add_child(_track_list)
    
    # Now playing
    _now_playing_label = Label.new()
    _now_playing_label.text = "Now Playing: --"
    _now_playing_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    _now_playing_label.add_theme_font_size_override("font_size", 10)
    _now_playing_label.add_theme_color_override("font_color", Color(0.7, 0.9, 0.7))
    vbox.add_child(_now_playing_label)
    
    # Close button
    _close_button = Button.new()
    _close_button.text = "Close"
    _close_button.pressed.connect(_close)
    vbox.add_child(_close_button)
    
    _update_tab_buttons()


func _populate_tracks() -> void:
    # Clear existing
    for child in _track_list.get_children():
        child.queue_free()
    
    var tracks: Array[Dictionary] = MUSIC_TRACKS if _showing_music else SFX_LIST
    
    for i in range(tracks.size()):
        var track = tracks[i]
        var btn = Button.new()
        btn.text = track["name"]
        btn.pressed.connect(_on_track_selected.bind(track["id"], track["name"]))
        _track_list.add_child(btn)


func _update_tab_buttons() -> void:
    _music_button.disabled = _showing_music
    _sfx_button.disabled = not _showing_music


func _on_music_tab() -> void:
    _showing_music = true
    _update_tab_buttons()
    _populate_tracks()


func _on_sfx_tab() -> void:
    _showing_music = false
    _update_tab_buttons()
    _populate_tracks()


func _on_track_selected(track_id: String, track_name: String) -> void:
    if _showing_music:
        MusicManager.play_music(track_id)
        _now_playing_label.text = "Now Playing: %s" % track_name
    else:
        SFXManager.play(track_id)
        _now_playing_label.text = "Played: %s" % track_name


func _close() -> void:
    get_tree().paused = false
    sound_test_closed.emit()
    queue_free()


func _input(event: InputEvent) -> void:
    if event.is_action_pressed("cancel") or event.is_action_pressed("pause"):
        get_viewport().set_input_as_handled()
        _close()


func show_sound_test() -> void:
    """Called to display the sound test UI."""
    get_tree().paused = true
