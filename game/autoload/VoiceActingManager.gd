extends Node
## Manages voice acting audio playback for dialogue.
## Stub implementation for future voice acting integration.

signal voice_started(audio_id: String)
signal voice_finished(audio_id: String)
signal voice_interrupted(audio_id: String)

const VOICE_PATH_BASE: String = "res://game/assets/audio/voice/"
const PLACEHOLDER_AUDIO: String = "res://game/assets/audio/voice/placeholder.ogg"

var _audio_player: AudioStreamPlayer
var _current_audio_id: String = ""
var _voice_enabled: bool = true
var _voice_volume: float = 1.0


func _ready() -> void:
    _audio_player = AudioStreamPlayer.new()
    _audio_player.bus = "Voice"
    _audio_player.finished.connect(_on_voice_finished)
    add_child(_audio_player)


func is_voice_enabled() -> bool:
    """Returns whether voice audio is enabled."""
    return _voice_enabled


func set_voice_enabled(enabled: bool) -> void:
    """Enable or disable voice audio."""
    _voice_enabled = enabled
    if not enabled and is_playing():
        stop_voice()


func get_voice_volume() -> float:
    """Returns voice volume (0.0 to 1.0)."""
    return _voice_volume


func set_voice_volume(volume: float) -> void:
    """Set voice volume (0.0 to 1.0)."""
    _voice_volume = clampf(volume, 0.0, 1.0)
    _audio_player.volume_db = linear_to_db(_voice_volume)


func is_playing() -> bool:
    """Returns whether voice audio is currently playing."""
    return _audio_player.playing


func get_current_audio_id() -> String:
    """Returns the ID of the currently playing audio."""
    return _current_audio_id


func play_voice(audio_id: String) -> bool:
    """
    Play a voice audio clip by ID.
    Audio ID format: character_scene_line (e.g., "fae_intro_001")
    Returns true if audio started, false if not found or disabled.
    """
    if not _voice_enabled:
        return false
    
    # Stop any currently playing voice
    if is_playing():
        _interrupt_current()
    
    # Build file path from audio ID
    var audio_path := _get_audio_path(audio_id)
    
    # Check if file exists
    if not ResourceLoader.exists(audio_path):
        # Try placeholder
        if ResourceLoader.exists(PLACEHOLDER_AUDIO):
            audio_path = PLACEHOLDER_AUDIO
        else:
            push_warning("[VoiceActingManager] Voice file not found: %s" % audio_path)
            return false
    
    # Load and play
    var stream = load(audio_path)
    if stream == null:
        push_warning("[VoiceActingManager] Failed to load voice: %s" % audio_path)
        return false
    
    _audio_player.stream = stream
    _audio_player.play()
    _current_audio_id = audio_id
    voice_started.emit(audio_id)
    return true


func stop_voice() -> void:
    """Stop the currently playing voice audio."""
    if is_playing():
        _audio_player.stop()
        _current_audio_id = ""


func _interrupt_current() -> void:
    """Interrupt current voice playback."""
    if _current_audio_id != "":
        var old_id := _current_audio_id
        stop_voice()
        voice_interrupted.emit(old_id)


func _get_audio_path(audio_id: String) -> String:
    """
    Convert audio ID to file path.
    Format: character_scene_line -> voice/character/scene/line.ogg
    Example: fae_intro_001 -> voice/fae/intro/001.ogg
    """
    var parts := audio_id.split("_")
    if parts.size() >= 3:
        var character := parts[0]
        var scene := parts[1]
        var line := parts[2]
        return "%s%s/%s/%s.ogg" % [VOICE_PATH_BASE, character, scene, line]
    else:
        # Simple fallback
        return "%s%s.ogg" % [VOICE_PATH_BASE, audio_id]


func _on_voice_finished() -> void:
    """Called when voice audio finishes playing."""
    var finished_id := _current_audio_id
    _current_audio_id = ""
    voice_finished.emit(finished_id)


# --- Dialogue Integration ---

func play_dialogue_voice(speaker: String, dialogue_index: int, scene_id: String = "default") -> bool:
    """
    Play voice for a dialogue line.
    speaker: Character name (e.g., "fae", "elder")
    dialogue_index: Line number in the dialogue sequence
    scene_id: Scene/conversation identifier
    """
    var audio_id := "%s_%s_%03d" % [speaker.to_lower(), scene_id, dialogue_index]
    return play_voice(audio_id)


# --- Save/Load ---

func get_save_data() -> Dictionary:
    """Returns data for save file."""
    return {
        "voice_enabled": _voice_enabled,
        "voice_volume": _voice_volume
    }


func load_save_data(data: Dictionary) -> void:
    """Loads data from save file."""
    if data.has("voice_enabled"):
        _voice_enabled = data["voice_enabled"]
    if data.has("voice_volume"):
        set_voice_volume(data["voice_volume"])
