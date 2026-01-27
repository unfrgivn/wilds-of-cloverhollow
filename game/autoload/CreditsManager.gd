extends Node
## Manages end-of-game credits display and playback.

signal credits_started
signal credits_ended
signal credits_skipped

const CREDITS_DATA: Dictionary = {
    "title": "Wilds of Cloverhollow",
    "sections": [
        {
            "header": "Created By",
            "entries": ["Clover Studios"]
        },
        {
            "header": "Game Design",
            "entries": ["Lead Designer - TBD"]
        },
        {
            "header": "Programming",
            "entries": ["Lead Programmer - TBD"]
        },
        {
            "header": "Art & Animation",
            "entries": ["Art Director - TBD", "Character Artist - TBD", "Environment Artist - TBD"]
        },
        {
            "header": "Music & Sound",
            "entries": ["Composer - TBD", "Sound Designer - TBD"]
        },
        {
            "header": "Writing",
            "entries": ["Lead Writer - TBD"]
        },
        {
            "header": "Quality Assurance",
            "entries": ["QA Lead - TBD"]
        },
        {
            "header": "Special Thanks",
            "entries": ["The Godot Engine Team", "Our Playtesters", "You, the Player!"]
        }
    ],
    "vignettes": [
        {"character": "fae", "text": "And so Fae's adventure continues..."},
        {"character": "pet", "text": "Always by their side."},
        {"character": "elder", "text": "The town is safe once more."},
        {"character": "friends", "text": "Friendship saved the day!"}
    ],
    "end_message": "Thank you for playing!"
}

var _credits_ui: CanvasLayer = null
var _is_playing: bool = false
var _can_skip: bool = true


func _ready() -> void:
    pass


func get_credits_data() -> Dictionary:
    """Returns the credits data dictionary."""
    return CREDITS_DATA


func is_playing() -> bool:
    """Returns true if credits are currently playing."""
    return _is_playing


func play_credits(can_skip: bool = true) -> void:
    """Start playing the credits sequence."""
    if _is_playing:
        return
    
    _can_skip = can_skip
    _is_playing = true
    
    # Load and show credits UI
    var credits_scene = load("res://game/scenes/ui/CreditsUI.tscn")
    if credits_scene:
        _credits_ui = credits_scene.instantiate()
        _credits_ui.credits_finished.connect(_on_credits_finished)
        _credits_ui.credits_skipped.connect(_on_credits_skipped)
        get_tree().root.add_child(_credits_ui)
        _credits_ui.start_credits(CREDITS_DATA, _can_skip)
    
    # Play credits music
    if MusicManager:
        MusicManager.play_music("credits")
    
    credits_started.emit()


func skip_credits() -> void:
    """Skip the credits if allowed."""
    if not _is_playing or not _can_skip:
        return
    
    if _credits_ui:
        _credits_ui.skip()


func stop_credits() -> void:
    """Stop credits playback."""
    if not _is_playing:
        return
    
    if _credits_ui:
        _credits_ui.queue_free()
        _credits_ui = null
    
    _is_playing = false


func _on_credits_finished() -> void:
    """Called when credits finish naturally."""
    _is_playing = false
    if _credits_ui:
        _credits_ui.queue_free()
        _credits_ui = null
    credits_ended.emit()


func _on_credits_skipped() -> void:
    """Called when credits are skipped."""
    _is_playing = false
    if _credits_ui:
        _credits_ui.queue_free()
        _credits_ui = null
    credits_skipped.emit()
