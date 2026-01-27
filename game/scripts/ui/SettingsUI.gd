extends CanvasLayer

## SettingsUI - Game settings menu with volume sliders and options

signal settings_closed

var _is_active: bool = false
var _selected_index: int = 0
var _options: Array[String] = ["Music Volume", "SFX Volume", "Touch Size", "Text Size", "Colorblind", "Dyslexia Font", "Language", "Credits", "Back"]

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var options_container: VBoxContainer = $Panel/OptionsContainer
@onready var music_slider: HSlider = $Panel/OptionsContainer/MusicRow/MusicSlider
@onready var music_value: Label = $Panel/OptionsContainer/MusicRow/MusicValue
@onready var sfx_slider: HSlider = $Panel/OptionsContainer/SFXRow/SFXSlider
@onready var sfx_value: Label = $Panel/OptionsContainer/SFXRow/SFXValue
@onready var touch_size_label: Label = $Panel/OptionsContainer/TouchRow/TouchSizeLabel
@onready var text_size_label: Label = $Panel/OptionsContainer/TextRow/TextSizeLabel
@onready var colorblind_label: Label = $Panel/OptionsContainer/ColorblindRow/ColorblindLabel
@onready var dyslexia_label: Label = $Panel/OptionsContainer/DyslexiaRow/DyslexiaLabel
@onready var language_label: Label = $Panel/OptionsContainer/LanguageRow/LanguageLabel
@onready var credits_button: Button = $Panel/OptionsContainer/CreditsButton
@onready var back_button: Button = $Panel/OptionsContainer/BackButton
@onready var dimmer: ColorRect = $Dimmer

const TOUCH_SIZE_NAMES: Array[String] = ["Small", "Medium", "Large"]

func _ready() -> void:
    add_to_group("settings_ui")
    visible = false
    process_mode = Node.PROCESS_MODE_ALWAYS
    
    # Connect slider signals
    music_slider.value_changed.connect(_on_music_changed)
    sfx_slider.value_changed.connect(_on_sfx_changed)
    credits_button.pressed.connect(_on_credits_pressed)
    back_button.pressed.connect(_on_back_pressed)

func _input(event: InputEvent) -> void:
    if not _is_active:
        return
    
    if event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
        close_settings()
        get_viewport().set_input_as_handled()
        return
    
    # Handle touch size cycling with left/right when on touch row
    if event.is_action_pressed("ui_left"):
        if _selected_index == 2:  # Touch Size row
            _cycle_touch_size(-1)
            get_viewport().set_input_as_handled()
        elif _selected_index == 3:  # Text Size row
            _cycle_text_size(-1)
            get_viewport().set_input_as_handled()
        elif _selected_index == 4:  # Colorblind row
            _cycle_colorblind_mode(-1)
            get_viewport().set_input_as_handled()
        elif _selected_index == 5:  # Dyslexia row
            _toggle_dyslexia_font()
            get_viewport().set_input_as_handled()
        elif _selected_index == 6:  # Language row
            _cycle_language(-1)
            get_viewport().set_input_as_handled()
    elif event.is_action_pressed("ui_right"):
        if _selected_index == 2:  # Touch Size row
            _cycle_touch_size(1)
            get_viewport().set_input_as_handled()
        elif _selected_index == 3:  # Text Size row
            _cycle_text_size(1)
            get_viewport().set_input_as_handled()
        elif _selected_index == 4:  # Colorblind row
            _cycle_colorblind_mode(1)
            get_viewport().set_input_as_handled()
        elif _selected_index == 5:  # Dyslexia row
            _toggle_dyslexia_font()
            get_viewport().set_input_as_handled()
        elif _selected_index == 6:  # Language row
            _cycle_language(1)
            get_viewport().set_input_as_handled()

func open_settings() -> void:
    _is_active = true
    visible = true
    _load_current_values()
    print("[SettingsUI] Opened")

func close_settings() -> void:
    _is_active = false
    visible = false
    SettingsManager.save_settings()
    settings_closed.emit()
    print("[SettingsUI] Closed")

func _load_current_values() -> void:
    music_slider.value = SettingsManager.music_volume * 100.0
    sfx_slider.value = SettingsManager.sfx_volume * 100.0
    _update_music_label()
    _update_sfx_label()
    _update_touch_size_label()
    _update_text_size_label()
    _update_colorblind_label()
    _update_dyslexia_label()
    _update_language_label()

func _on_music_changed(value: float) -> void:
    SettingsManager.set_music_volume(value / 100.0)
    _update_music_label()

func _on_sfx_changed(value: float) -> void:
    SettingsManager.set_sfx_volume(value / 100.0)
    _update_sfx_label()

func _update_music_label() -> void:
    music_value.text = str(int(music_slider.value)) + "%"

func _update_sfx_label() -> void:
    sfx_value.text = str(int(sfx_slider.value)) + "%"

func _update_touch_size_label() -> void:
    var size_idx := SettingsManager.touch_control_size
    touch_size_label.text = TOUCH_SIZE_NAMES[size_idx]

func _cycle_touch_size(direction: int) -> void:
    var new_size := SettingsManager.touch_control_size + direction
    new_size = wrapi(new_size, 0, 3)
    SettingsManager.set_touch_control_size(new_size)
    _update_touch_size_label()

func _update_text_size_label() -> void:
    if text_size_label:
        text_size_label.text = SettingsManager.get_text_size_name()

func _cycle_text_size(direction: int) -> void:
    var new_size := SettingsManager.text_size + direction
    new_size = wrapi(new_size, 0, 3)
    SettingsManager.set_text_size(new_size)
    _update_text_size_label()

func _update_colorblind_label() -> void:
    if colorblind_label:
        colorblind_label.text = SettingsManager.get_colorblind_mode_name()

func _cycle_colorblind_mode(direction: int) -> void:
    var current: int = SettingsManager.colorblind_mode
    var new_mode: int = wrapi(current + direction, 0, 3)
    SettingsManager.set_colorblind_mode(new_mode)
    _update_colorblind_label()

func _update_dyslexia_label() -> void:
    if dyslexia_label:
        dyslexia_label.text = SettingsManager.get_dyslexia_font_name()

func _toggle_dyslexia_font() -> void:
    SettingsManager.set_dyslexia_font(not SettingsManager.dyslexia_font_enabled)
    _update_dyslexia_label()

func _update_language_label() -> void:
    if language_label:
        language_label.text = LocalizationManager.get_current_locale_name()

func _cycle_language(direction: int) -> void:
    LocalizationManager.cycle_locale(direction)
    SettingsManager.set_locale(LocalizationManager.get_locale())
    _update_language_label()

func _on_credits_pressed() -> void:
    # Show credits dialog (placeholder for now)
    print("[SettingsUI] Credits pressed - placeholder")
    DialogueManager.show_dialogue("Wilds of Cloverhollow\nCreated with love!")

func _on_back_pressed() -> void:
    close_settings()
