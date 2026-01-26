extends Node

## SFXManager - Handles sound effect playback

signal sfx_played(sfx_id: String)

# SFX categories and their paths
const SFX_PATHS: Dictionary = {
    # Menu navigation
    "menu_move": "res://game/assets/audio/sfx/menu_move.wav",
    "menu_select": "res://game/assets/audio/sfx/menu_select.wav",
    "menu_cancel": "res://game/assets/audio/sfx/menu_cancel.wav",
    "menu_error": "res://game/assets/audio/sfx/menu_error.wav",
    # Battle sounds
    "attack_hit": "res://game/assets/audio/sfx/attack_hit.wav",
    "attack_miss": "res://game/assets/audio/sfx/attack_miss.wav",
    "attack_critical": "res://game/assets/audio/sfx/attack_critical.wav",
    "enemy_hit": "res://game/assets/audio/sfx/enemy_hit.wav",
    "defend": "res://game/assets/audio/sfx/defend.wav",
    "heal": "res://game/assets/audio/sfx/heal.wav",
    "skill_cast": "res://game/assets/audio/sfx/skill_cast.wav",
    "battle_start": "res://game/assets/audio/sfx/battle_start.wav",
    "victory": "res://game/assets/audio/sfx/victory.wav",
    "defeat": "res://game/assets/audio/sfx/defeat.wav",
    "run_away": "res://game/assets/audio/sfx/run_away.wav",
    # Interaction sounds
    "dialogue_open": "res://game/assets/audio/sfx/dialogue_open.wav",
    "dialogue_close": "res://game/assets/audio/sfx/dialogue_close.wav",
    "dialogue_char": "res://game/assets/audio/sfx/dialogue_char.wav",
    "item_pickup": "res://game/assets/audio/sfx/item_pickup.wav",
    "tool_acquire": "res://game/assets/audio/sfx/tool_acquire.wav",
    "door_open": "res://game/assets/audio/sfx/door_open.wav",
    "chest_open": "res://game/assets/audio/sfx/chest_open.wav",
    # Quest sounds
    "quest_accept": "res://game/assets/audio/sfx/quest_accept.wav",
    "quest_complete": "res://game/assets/audio/sfx/quest_complete.wav",
    "objective_complete": "res://game/assets/audio/sfx/objective_complete.wav",
    # Misc sounds
    "save_game": "res://game/assets/audio/sfx/save_game.wav",
    "error": "res://game/assets/audio/sfx/error.wav",
    "coin": "res://game/assets/audio/sfx/coin.wav",
    "footstep": "res://game/assets/audio/sfx/footstep.wav",
}

# Pool of audio players for simultaneous playback
const POOL_SIZE := 8
var _sfx_players: Array[AudioStreamPlayer] = []
var _current_pool_index: int = 0
var _last_sfx: String = ""

func _ready() -> void:
    # Create pool of audio players
    for i in range(POOL_SIZE):
        var player := AudioStreamPlayer.new()
        player.bus = "SFX"
        add_child(player)
        _sfx_players.append(player)
    print("[SFXManager] Initialized with ", POOL_SIZE, " audio players")

func play(sfx_id: String, volume_db: float = 0.0, pitch_scale: float = 1.0) -> void:
    var path: String = SFX_PATHS.get(sfx_id, "")
    if path == "":
        push_warning("[SFXManager] Unknown SFX: ", sfx_id)
        return
    
    if not ResourceLoader.exists(path):
        print("[SFXManager] SFX file not found (placeholder): ", sfx_id)
        _last_sfx = sfx_id
        sfx_played.emit(sfx_id)
        return
    
    var stream := load(path) as AudioStream
    if stream:
        var player := _get_next_player()
        player.stream = stream
        player.volume_db = volume_db
        player.pitch_scale = pitch_scale
        player.play()
        _last_sfx = sfx_id
        sfx_played.emit(sfx_id)
        print("[SFXManager] Playing: ", sfx_id)

func _get_next_player() -> AudioStreamPlayer:
    # Round-robin through the pool
    var player := _sfx_players[_current_pool_index]
    _current_pool_index = (_current_pool_index + 1) % POOL_SIZE
    return player

# Convenience methods for common SFX
func play_menu_move() -> void:
    play("menu_move")

func play_menu_select() -> void:
    play("menu_select")

func play_menu_cancel() -> void:
    play("menu_cancel")

func play_menu_error() -> void:
    play("menu_error")

func play_attack_hit() -> void:
    play("attack_hit")

func play_attack_miss() -> void:
    play("attack_miss")

func play_attack_critical() -> void:
    play("attack_critical")

func play_dialogue_open() -> void:
    play("dialogue_open")

func play_dialogue_close() -> void:
    play("dialogue_close")

func play_item_pickup() -> void:
    play("item_pickup")

func play_quest_accept() -> void:
    play("quest_accept")

func play_quest_complete() -> void:
    play("quest_complete")

func get_last_sfx() -> String:
    return _last_sfx

func stop_all() -> void:
    for player in _sfx_players:
        player.stop()
    print("[SFXManager] Stopped all SFX")
