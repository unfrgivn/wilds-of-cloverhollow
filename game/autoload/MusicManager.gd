extends Node

## MusicManager - Handles area-based and battle music playback

signal music_changed(track_id: String)

# Music track IDs mapped to areas
const AREA_MUSIC: Dictionary = {
    # Town areas - cozy town theme
    "Area_TownCenter": "town_theme",
    "Area_HeroHouse": "town_theme",
    "Area_HeroHouseInterior": "home_theme",
    "Area_HeroHouseUpper": "home_theme",
    "Area_School": "town_theme",
    "Area_SchoolHall": "school_theme",
    "Area_SchoolClassroom": "school_theme",
    "Area_Arcade": "arcade_theme",
    "Area_ArcadeInterior": "arcade_theme",
    "Area_GeneralStore": "shop_theme",
    "Area_Library": "library_theme",
    "Area_Cafe": "cafe_theme",
    "Area_CafeInterior": "cafe_theme",
    "Area_TownHall": "town_theme",
    "Area_TownHallInterior": "town_theme",
    "Area_PetShop": "shop_theme",
    "Area_PetShopInterior": "shop_theme",
    "Area_Blacksmith": "shop_theme",
    "Area_BlacksmithInterior": "shop_theme",
    "Area_Clinic": "town_theme",
    "Area_ClinicInterior": "town_theme",
    "Area_TownPark": "park_theme",
    # Wilderness areas
    "Area_BubblegumBay": "bay_theme",
    "Area_Forest": "forest_theme",
}

# Special music tracks
const BATTLE_MUSIC := "battle_theme"
const VICTORY_MUSIC := "victory_fanfare"
const TITLE_MUSIC := "title_theme"
const DEFAULT_MUSIC := "town_theme"

# Placeholder track paths (will be replaced with actual music)
const MUSIC_PATHS: Dictionary = {
    "town_theme": "res://game/assets/audio/music/town_theme.ogg",
    "home_theme": "res://game/assets/audio/music/home_theme.ogg",
    "school_theme": "res://game/assets/audio/music/school_theme.ogg",
    "arcade_theme": "res://game/assets/audio/music/arcade_theme.ogg",
    "shop_theme": "res://game/assets/audio/music/shop_theme.ogg",
    "library_theme": "res://game/assets/audio/music/library_theme.ogg",
    "cafe_theme": "res://game/assets/audio/music/cafe_theme.ogg",
    "park_theme": "res://game/assets/audio/music/park_theme.ogg",
    "bay_theme": "res://game/assets/audio/music/bay_theme.ogg",
    "forest_theme": "res://game/assets/audio/music/forest_theme.ogg",
    "battle_theme": "res://game/assets/audio/music/battle_theme.ogg",
    "victory_fanfare": "res://game/assets/audio/music/victory_fanfare.ogg",
    "title_theme": "res://game/assets/audio/music/title_theme.ogg",
}

var _current_track: String = ""
var _previous_track: String = ""  # For resuming after battle
var _music_player: AudioStreamPlayer = null
var _fade_tween: Tween = null
var _is_fading: bool = false

func _ready() -> void:
    _music_player = AudioStreamPlayer.new()
    _music_player.bus = "Music"
    add_child(_music_player)
    print("[MusicManager] Initialized")

func play_music(track_id: String, fade_duration: float = 0.5) -> void:
    if track_id == _current_track and _music_player.playing:
        return  # Already playing this track
    
    print("[MusicManager] Playing: ", track_id)
    
    if _music_player.playing and fade_duration > 0:
        _crossfade_to(track_id, fade_duration)
    else:
        _play_track(track_id)

func _play_track(track_id: String) -> void:
    var path: String = MUSIC_PATHS.get(track_id, "")
    if path == "":
        push_warning("[MusicManager] Unknown track: ", track_id)
        return
    
    if not ResourceLoader.exists(path):
        print("[MusicManager] Track file not found (placeholder): ", path)
        _current_track = track_id
        music_changed.emit(track_id)
        return
    
    var stream := load(path) as AudioStream
    if stream:
        _music_player.stream = stream
        _music_player.volume_db = 0.0
        _music_player.play()
        _current_track = track_id
        music_changed.emit(track_id)

func _crossfade_to(track_id: String, duration: float) -> void:
    if _fade_tween:
        _fade_tween.kill()
    
    _is_fading = true
    _fade_tween = create_tween()
    _fade_tween.tween_property(_music_player, "volume_db", -40.0, duration * 0.5)
    _fade_tween.tween_callback(func():
        _play_track(track_id)
        _music_player.volume_db = -40.0
    )
    _fade_tween.tween_property(_music_player, "volume_db", 0.0, duration * 0.5)
    _fade_tween.tween_callback(func():
        _is_fading = false
    )

func stop_music(fade_duration: float = 0.5) -> void:
    print("[MusicManager] Stopping music")
    if fade_duration > 0 and _music_player.playing:
        if _fade_tween:
            _fade_tween.kill()
        _fade_tween = create_tween()
        _fade_tween.tween_property(_music_player, "volume_db", -40.0, fade_duration)
        _fade_tween.tween_callback(func():
            _music_player.stop()
            _current_track = ""
        )
    else:
        _music_player.stop()
        _current_track = ""

func play_area_music(area_name: String) -> void:
    var track_id: String = AREA_MUSIC.get(area_name, DEFAULT_MUSIC)
    play_music(track_id)

func play_battle_music() -> void:
    _previous_track = _current_track
    play_music(BATTLE_MUSIC)

func play_victory_music() -> void:
    play_music(VICTORY_MUSIC, 0.0)  # Immediate for fanfare

func resume_previous_music() -> void:
    if _previous_track != "":
        play_music(_previous_track)
        _previous_track = ""

func play_title_music() -> void:
    play_music(TITLE_MUSIC)

func get_current_track() -> String:
    return _current_track

func is_playing() -> bool:
    return _music_player.playing
