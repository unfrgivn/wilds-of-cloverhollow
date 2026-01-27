extends Node
## TradingManager - Handles item trading (stub for future multiplayer)

signal trade_started()
signal trade_cancelled()
signal trade_completed(my_items: Array, their_items: Array)
signal offer_updated(player_id: int, items: Array)
signal trade_confirmed(player_id: int)
signal trade_state_changed(state: int)

enum TradeState {
    NONE,
    PENDING,
    OFFER_PHASE,
    CONFIRM_PHASE,
    COMPLETED,
    CANCELLED
}

var _trade_state: TradeState = TradeState.NONE
var _my_offer: Array = []  # Array of {item_id, count}
var _their_offer: Array = []  # Array of {item_id, count}
var _my_confirmed: bool = false
var _their_confirmed: bool = false

func _ready() -> void:
    pass

# ---- Public API ----

func get_trade_state() -> TradeState:
    return _trade_state

func is_in_trade() -> bool:
    return _trade_state != TradeState.NONE

func get_my_offer() -> Array:
    return _my_offer.duplicate()

func get_their_offer() -> Array:
    return _their_offer.duplicate()

func start_trade() -> bool:
    ## Start a new trade session (stub - would connect to another player)
    if _trade_state != TradeState.NONE:
        return false
    
    _trade_state = TradeState.OFFER_PHASE
    _my_offer.clear()
    _their_offer.clear()
    _my_confirmed = false
    _their_confirmed = false
    
    trade_started.emit()
    trade_state_changed.emit(_trade_state)
    return true

func add_to_offer(item_id: String, count: int = 1) -> bool:
    ## Add an item to my trade offer
    if _trade_state != TradeState.OFFER_PHASE:
        return false
    
    # Check if item already in offer, increase count
    for item in _my_offer:
        if item.get("item_id") == item_id:
            item["count"] = item.get("count", 0) + count
            offer_updated.emit(0, _my_offer)
            return true
    
    _my_offer.append({"item_id": item_id, "count": count})
    offer_updated.emit(0, _my_offer)
    return true

func remove_from_offer(item_id: String, count: int = 1) -> bool:
    ## Remove an item from my trade offer
    if _trade_state != TradeState.OFFER_PHASE:
        return false
    
    for i in range(_my_offer.size()):
        var item: Dictionary = _my_offer[i]
        if item.get("item_id") == item_id:
            var new_count: int = item.get("count", 0) - count
            if new_count <= 0:
                _my_offer.remove_at(i)
            else:
                item["count"] = new_count
            offer_updated.emit(0, _my_offer)
            return true
    return false

func clear_my_offer() -> void:
    _my_offer.clear()
    offer_updated.emit(0, _my_offer)

func set_their_offer(items: Array) -> void:
    ## Stub: Set the other player's offer (simulated)
    _their_offer = items.duplicate()
    offer_updated.emit(1, _their_offer)

func confirm_trade() -> bool:
    ## Confirm my side of the trade
    if _trade_state != TradeState.OFFER_PHASE and _trade_state != TradeState.CONFIRM_PHASE:
        return false
    
    _my_confirmed = true
    _trade_state = TradeState.CONFIRM_PHASE
    trade_confirmed.emit(0)
    trade_state_changed.emit(_trade_state)
    
    _check_trade_complete()
    return true

func simulate_their_confirm() -> void:
    ## Stub: Simulate the other player confirming
    _their_confirmed = true
    trade_confirmed.emit(1)
    _check_trade_complete()

func _check_trade_complete() -> void:
    if _my_confirmed and _their_confirmed:
        _complete_trade()

func _complete_trade() -> void:
    _trade_state = TradeState.COMPLETED
    
    # TODO: Actually transfer items via InventoryManager
    # for item in _my_offer:
    #     InventoryManager.remove_item(item.get("item_id"), item.get("count", 1))
    # for item in _their_offer:
    #     InventoryManager.add_item(item.get("item_id"), item.get("count", 1))
    
    trade_completed.emit(_my_offer.duplicate(), _their_offer.duplicate())
    trade_state_changed.emit(_trade_state)
    
    # Reset after a moment
    _reset_trade()

func cancel_trade() -> void:
    ## Cancel the current trade
    if _trade_state == TradeState.NONE:
        return
    
    _trade_state = TradeState.CANCELLED
    trade_cancelled.emit()
    trade_state_changed.emit(_trade_state)
    
    _reset_trade()

func _reset_trade() -> void:
    _trade_state = TradeState.NONE
    _my_offer.clear()
    _their_offer.clear()
    _my_confirmed = false
    _their_confirmed = false

# ---- Save/Load Integration ----

func get_save_data() -> Dictionary:
    # No persistent trade data - trades are ephemeral
    return {}

func load_save_data(_data: Dictionary) -> void:
    _reset_trade()
