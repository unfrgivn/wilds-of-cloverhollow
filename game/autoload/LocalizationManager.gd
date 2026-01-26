extends Node

## LocalizationManager - Handles game localization and language switching

signal language_changed(locale: String)

const SUPPORTED_LOCALES: Array[String] = ["en", "es", "fr"]
const LOCALE_NAMES: Dictionary = {
    "en": "English",
    "es": "Español",
    "fr": "Français"
}

var current_locale: String = "en"

func _ready() -> void:
    # Load saved locale from SettingsManager
    var saved_locale := _get_saved_locale()
    if saved_locale in SUPPORTED_LOCALES:
        set_locale(saved_locale)
    else:
        # Try to detect system locale
        var system_locale := OS.get_locale_language()
        if system_locale in SUPPORTED_LOCALES:
            set_locale(system_locale)
        else:
            set_locale("en")
    
    print("[LocalizationManager] Initialized with locale: %s" % current_locale)

func set_locale(locale: String) -> void:
    if locale not in SUPPORTED_LOCALES:
        push_warning("[LocalizationManager] Unsupported locale: %s" % locale)
        return
    
    current_locale = locale
    TranslationServer.set_locale(locale)
    language_changed.emit(locale)
    print("[LocalizationManager] Locale set to: %s (%s)" % [locale, get_locale_name(locale)])

func get_locale() -> String:
    return current_locale

func get_locale_name(locale: String) -> String:
    return LOCALE_NAMES.get(locale, locale)

func get_current_locale_name() -> String:
    return get_locale_name(current_locale)

func get_supported_locales() -> Array[String]:
    return SUPPORTED_LOCALES.duplicate()

func get_locale_index() -> int:
    return SUPPORTED_LOCALES.find(current_locale)

func set_locale_by_index(index: int) -> void:
    if index >= 0 and index < SUPPORTED_LOCALES.size():
        set_locale(SUPPORTED_LOCALES[index])

func cycle_locale(direction: int) -> void:
    var current_index := get_locale_index()
    var new_index := wrapi(current_index + direction, 0, SUPPORTED_LOCALES.size())
    set_locale_by_index(new_index)

func _get_saved_locale() -> String:
    # Check SettingsManager for saved locale
    if Engine.has_singleton("SettingsManager"):
        return ""  # Let SettingsManager handle this
    
    # Fallback: check settings file directly
    const SETTINGS_FILE := "user://settings.json"
    if not FileAccess.file_exists(SETTINGS_FILE):
        return ""
    
    var file := FileAccess.open(SETTINGS_FILE, FileAccess.READ)
    if not file:
        return ""
    
    var content := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    if json.parse(content) != OK:
        return ""
    
    var data: Dictionary = json.data
    return data.get("locale", "")

func get_save_data() -> Dictionary:
    return {"locale": current_locale}

func load_save_data(data: Dictionary) -> void:
    var locale := data.get("locale", "en") as String
    if locale in SUPPORTED_LOCALES:
        set_locale(locale)
