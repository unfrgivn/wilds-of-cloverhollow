extends Node
## Multiplayer co-op exploration stub.
##
## This is a placeholder for future multiplayer functionality.
## No actual networking is implemented - just state serialization
## and message schema definitions for future integration.

# ── Signals ──────────────────────────────────────────────────────────────────
signal connection_state_changed(state: int)
signal player_joined(player_id: String)
signal player_left(player_id: String)
signal message_received(from_id: String, message: Dictionary)
signal state_synchronized

# ── Enums ────────────────────────────────────────────────────────────────────
enum ConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    HOST,
    ERROR
}

enum MessageType {
    PLAYER_STATE,
    PLAYER_ACTION,
    CHAT,
    SYNC_REQUEST,
    SYNC_RESPONSE,
    PING,
    PONG
}

# ── Constants ────────────────────────────────────────────────────────────────
const MAX_PLAYERS: int = 4
const SYNC_INTERVAL_MS: int = 100  # 10 Hz
const MESSAGE_SCHEMA_VERSION: int = 1

# ── State ────────────────────────────────────────────────────────────────────
var _connection_state: ConnectionState = ConnectionState.DISCONNECTED
var _local_player_id: String = ""
var _connected_players: Dictionary = {}  # player_id -> PlayerState
var _is_host: bool = false
var _message_queue: Array[Dictionary] = []
var _last_sync_time: int = 0


# ── Lifecycle ────────────────────────────────────────────────────────────────
func _ready() -> void:
    _local_player_id = _generate_player_id()


# ── Connection API (stubs) ───────────────────────────────────────────────────
func host_game(port: int = 7777) -> bool:
    ## Host a multiplayer game (stub - no actual networking).
    push_warning("[MultiplayerStub] host_game() is a stub - no actual networking")
    _is_host = true
    _connection_state = ConnectionState.HOST
    _connected_players[_local_player_id] = _create_local_player_state()
    connection_state_changed.emit(_connection_state)
    return true


func join_game(_host_address: String, _port: int = 7777) -> bool:
    ## Join a multiplayer game (stub - no actual networking).
    push_warning("[MultiplayerStub] join_game() is a stub - no actual networking")
    _is_host = false
    _connection_state = ConnectionState.CONNECTED
    _connected_players[_local_player_id] = _create_local_player_state()
    connection_state_changed.emit(_connection_state)
    return true


func disconnect_game() -> void:
    ## Disconnect from the current game.
    _connection_state = ConnectionState.DISCONNECTED
    _connected_players.clear()
    _is_host = false
    connection_state_changed.emit(_connection_state)


func is_multiplayer_connected() -> bool:
    return _connection_state == ConnectionState.CONNECTED or _connection_state == ConnectionState.HOST


func is_host() -> bool:
    return _is_host


func get_connection_state() -> ConnectionState:
    return _connection_state


func get_connection_state_name() -> String:
    match _connection_state:
        ConnectionState.DISCONNECTED: return "Disconnected"
        ConnectionState.CONNECTING: return "Connecting"
        ConnectionState.CONNECTED: return "Connected"
        ConnectionState.HOST: return "Host"
        ConnectionState.ERROR: return "Error"
        _: return "Unknown"


# ── Player State Serialization ───────────────────────────────────────────────
func serialize_player_state() -> Dictionary:
    ## Serialize local player state for network transmission.
    var player_node = get_tree().get_first_node_in_group("player")
    var state: Dictionary = {
        "schema_version": MESSAGE_SCHEMA_VERSION,
        "player_id": _local_player_id,
        "timestamp": Time.get_ticks_msec(),
        "position": {"x": 0.0, "y": 0.0},
        "facing": "down",
        "area": "",
        "animation": "idle",
        "inventory": {},
        "story_flags": {}
    }
    
    if player_node:
        state["position"] = {
            "x": player_node.global_position.x,
            "y": player_node.global_position.y
        }
        if player_node.has_method("get_facing_direction"):
            state["facing"] = player_node.get_facing_direction()
    
    # Include inventory if available
    if InventoryManager:
        state["inventory"] = InventoryManager.get_save_data()
    
    # Include current area
    if SceneRouter:
        state["area"] = SceneRouter.get_current_area_path()
    
    return state


func deserialize_player_state(data: Dictionary) -> bool:
    ## Deserialize and apply player state (stub - doesn't actually apply).
    if not data.has("schema_version"):
        push_error("[MultiplayerStub] Invalid state data - missing schema_version")
        return false
    
    if data.get("schema_version", 0) != MESSAGE_SCHEMA_VERSION:
        push_warning("[MultiplayerStub] Schema version mismatch")
        return false
    
    var player_id: String = data.get("player_id", "")
    if player_id.is_empty():
        return false
    
    _connected_players[player_id] = data
    return true


func get_connected_players() -> Array:
    ## Returns array of connected player IDs.
    return _connected_players.keys()


func get_player_count() -> int:
    return _connected_players.size()


func get_player_state(player_id: String) -> Dictionary:
    return _connected_players.get(player_id, {})


# ── Message API ──────────────────────────────────────────────────────────────
func create_message(type: MessageType, payload: Dictionary = {}) -> Dictionary:
    ## Create a network message with proper schema.
    return {
        "schema_version": MESSAGE_SCHEMA_VERSION,
        "type": type,
        "from": _local_player_id,
        "timestamp": Time.get_ticks_msec(),
        "payload": payload
    }


func send_message(_to_player: String, message: Dictionary) -> bool:
    ## Send a message to another player (stub - queues locally).
    push_warning("[MultiplayerStub] send_message() is a stub - message queued locally")
    _message_queue.append(message)
    return true


func broadcast_message(message: Dictionary) -> bool:
    ## Broadcast a message to all players (stub - queues locally).
    push_warning("[MultiplayerStub] broadcast_message() is a stub - message queued locally")
    _message_queue.append(message)
    return true


func get_pending_messages() -> Array[Dictionary]:
    var messages: Array[Dictionary] = _message_queue.duplicate()
    _message_queue.clear()
    return messages


func send_player_state() -> void:
    ## Broadcast current player state to all connected players.
    var state: Dictionary = serialize_player_state()
    var message: Dictionary = create_message(MessageType.PLAYER_STATE, state)
    broadcast_message(message)


func send_player_action(action: String, data: Dictionary = {}) -> void:
    ## Send a player action (interact, attack, etc.) to other players.
    var payload: Dictionary = {
        "action": action,
        "data": data
    }
    var message: Dictionary = create_message(MessageType.PLAYER_ACTION, payload)
    broadcast_message(message)


func send_chat(text: String) -> void:
    ## Send a chat message to all players.
    var payload: Dictionary = {"text": text}
    var message: Dictionary = create_message(MessageType.CHAT, payload)
    broadcast_message(message)


# ── Network Message Schema ───────────────────────────────────────────────────
func get_message_schema() -> Dictionary:
    ## Returns the network message schema for documentation/validation.
    return {
        "version": MESSAGE_SCHEMA_VERSION,
        "message_types": {
            "PLAYER_STATE": {
                "description": "Full player state synchronization",
                "fields": ["player_id", "position", "facing", "area", "animation", "inventory", "story_flags"]
            },
            "PLAYER_ACTION": {
                "description": "Player performed an action",
                "fields": ["action", "data"]
            },
            "CHAT": {
                "description": "Chat message",
                "fields": ["text"]
            },
            "SYNC_REQUEST": {
                "description": "Request full state sync from host",
                "fields": []
            },
            "SYNC_RESPONSE": {
                "description": "Full state response from host",
                "fields": ["world_state", "player_states"]
            },
            "PING": {
                "description": "Latency measurement",
                "fields": ["sent_at"]
            },
            "PONG": {
                "description": "Latency response",
                "fields": ["sent_at", "received_at"]
            }
        }
    }


# ── Simulation (for testing) ─────────────────────────────────────────────────
func simulate_player_join(player_id: String) -> void:
    ## Simulate a player joining for testing.
    _connected_players[player_id] = {
        "player_id": player_id,
        "position": {"x": 100.0, "y": 100.0},
        "facing": "down",
        "area": "res://game/scenes/areas/Area_TownCenter.tscn",
        "animation": "idle"
    }
    player_joined.emit(player_id)


func simulate_player_leave(player_id: String) -> void:
    ## Simulate a player leaving for testing.
    if _connected_players.has(player_id):
        _connected_players.erase(player_id)
        player_left.emit(player_id)


func simulate_message(from_id: String, type: MessageType, payload: Dictionary) -> void:
    ## Simulate receiving a message for testing.
    var message: Dictionary = {
        "schema_version": MESSAGE_SCHEMA_VERSION,
        "type": type,
        "from": from_id,
        "timestamp": Time.get_ticks_msec(),
        "payload": payload
    }
    message_received.emit(from_id, message)


# ── Persistence ──────────────────────────────────────────────────────────────
func get_save_data() -> Dictionary:
    return {
        "local_player_id": _local_player_id
    }


func load_save_data(data: Dictionary) -> void:
    _local_player_id = data.get("local_player_id", _generate_player_id())


func reset() -> void:
    ## Reset all multiplayer state.
    disconnect_game()
    _local_player_id = _generate_player_id()
    _message_queue.clear()
    _last_sync_time = 0


# ── Internal ─────────────────────────────────────────────────────────────────
func _generate_player_id() -> String:
    return "player_%d" % randi()


func _create_local_player_state() -> Dictionary:
    return serialize_player_state()
