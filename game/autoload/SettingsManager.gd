extends Node

## SettingsManager - Handles game settings persistence

signal settings_changed

const SETTINGS_FILE := "user://settings.json"

# Audio settings
var music_volume: float = 1.0
var sfx_volume: float = 1.0

# Touch controls settings
var touch_control_size: int = 1  # 0=small, 1=medium, 2=large

# Audio bus indices (configured in Godot project)
const MUSIC_BUS := "Music"
const SFX_BUS := "Master"

func _ready() -> void:
    load_settings()

func set_music_volume(value: float) -> void:
    music_volume = clampf(value, 0.0, 1.0)
    _apply_volume(MUSIC_BUS, music_volume)
    settings_changed.emit()
    print("[SettingsManager] Music volume: ", music_volume)

func set_sfx_volume(value: float) -> void:
    sfx_volume = clampf(value, 0.0, 1.0)
    _apply_volume(SFX_BUS, sfx_volume)
    settings_changed.emit()
    print("[SettingsManager] SFX volume: ", sfx_volume)

func set_touch_control_size(size: int) -> void:
    touch_control_size = clampi(size, 0, 2)
    settings_changed.emit()
    print("[SettingsManager] Touch control size: ", touch_control_size)

func _apply_volume(bus_name: String, value: float) -> void:
    var bus_index := AudioServer.get_bus_index(bus_name)
    if bus_index >= 0:
        # Convert linear 0-1 to dB (-80 to 0)
        if value <= 0:
            AudioServer.set_bus_mute(bus_index, true)
        else:
            AudioServer.set_bus_mute(bus_index, false)
            var db := linear_to_db(value)
            AudioServer.set_bus_volume_db(bus_index, db)

func save_settings() -> void:
    var data := {
        "version": 1,
        "music_volume": music_volume,
        "sfx_volume": sfx_volume,
        "touch_control_size": touch_control_size,
    }
    
    var file := FileAccess.open(SETTINGS_FILE, FileAccess.WRITE)
    if file:
        file.store_string(JSON.stringify(data, "\t"))
        file.close()
        print("[SettingsManager] Settings saved")
    else:
        push_error("[SettingsManager] Failed to save settings")

func load_settings() -> void:
    if not FileAccess.file_exists(SETTINGS_FILE):
        print("[SettingsManager] No settings file, using defaults")
        return
    
    var file := FileAccess.open(SETTINGS_FILE, FileAccess.READ)
    if not file:
        push_error("[SettingsManager] Failed to open settings file")
        return
    
    var content := file.get_as_text()
    file.close()
    
    var json := JSON.new()
    var error := json.parse(content)
    if error != OK:
        push_error("[SettingsManager] Failed to parse settings: ", json.get_error_message())
        return
    
    var data: Dictionary = json.data
    music_volume = data.get("music_volume", 1.0)
    sfx_volume = data.get("sfx_volume", 1.0)
    touch_control_size = data.get("touch_control_size", 1)
    
    # Apply loaded settings
    _apply_volume(MUSIC_BUS, music_volume)
    _apply_volume(SFX_BUS, sfx_volume)
    
    print("[SettingsManager] Settings loaded")

func get_save_data() -> Dictionary:
    return {
        "music_volume": music_volume,
        "sfx_volume": sfx_volume,
        "touch_control_size": touch_control_size,
    }

func load_save_data(data: Dictionary) -> void:
    music_volume = data.get("music_volume", 1.0)
    sfx_volume = data.get("sfx_volume", 1.0)
    touch_control_size = data.get("touch_control_size", 1)
    _apply_volume(MUSIC_BUS, music_volume)
    _apply_volume(SFX_BUS, sfx_volume)
