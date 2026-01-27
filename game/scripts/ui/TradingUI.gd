extends CanvasLayer
## TradingUI - Trade interface for item exchange (stub)

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var status_label: Label = $Panel/StatusLabel
@onready var my_offer_list: VBoxContainer = $Panel/MyOfferPanel/OfferList
@onready var their_offer_list: VBoxContainer = $Panel/TheirOfferPanel/OfferList
@onready var confirm_button: Button = $Panel/ConfirmButton
@onready var cancel_button: Button = $Panel/CancelButton
@onready var add_item_button: Button = $Panel/AddItemButton

var _confirmed: bool = false

func _ready() -> void:
    visible = false
    confirm_button.pressed.connect(_on_confirm)
    cancel_button.pressed.connect(_on_cancel)
    add_item_button.pressed.connect(_on_add_item)
    
    TradingManager.trade_started.connect(_on_trade_started)
    TradingManager.trade_cancelled.connect(_on_trade_cancelled)
    TradingManager.trade_completed.connect(_on_trade_completed)
    TradingManager.offer_updated.connect(_on_offer_updated)
    TradingManager.trade_confirmed.connect(_on_trade_confirmed)

func show_trade_ui() -> void:
    visible = true
    _confirmed = false
    _refresh_display()

func _refresh_display() -> void:
    # Clear lists
    for child in my_offer_list.get_children():
        child.queue_free()
    for child in their_offer_list.get_children():
        child.queue_free()
    
    # Populate my offer
    for item in TradingManager.get_my_offer():
        var label := Label.new()
        label.text = "%s x%d" % [item.get("item_id", "???"), item.get("count", 1)]
        my_offer_list.add_child(label)
    
    # Populate their offer
    for item in TradingManager.get_their_offer():
        var label := Label.new()
        label.text = "%s x%d" % [item.get("item_id", "???"), item.get("count", 1)]
        their_offer_list.add_child(label)
    
    # Update status
    var state := TradingManager.get_trade_state()
    match state:
        TradingManager.TradeState.NONE:
            status_label.text = "No active trade"
        TradingManager.TradeState.OFFER_PHASE:
            status_label.text = "Add items to trade"
        TradingManager.TradeState.CONFIRM_PHASE:
            status_label.text = "Waiting for confirmation..."
        TradingManager.TradeState.COMPLETED:
            status_label.text = "Trade complete!"
        TradingManager.TradeState.CANCELLED:
            status_label.text = "Trade cancelled"
    
    confirm_button.text = "Confirmed" if _confirmed else "Confirm"
    confirm_button.disabled = _confirmed

func _on_confirm() -> void:
    if TradingManager.confirm_trade():
        _confirmed = true
        _refresh_display()

func _on_cancel() -> void:
    TradingManager.cancel_trade()

func _on_add_item() -> void:
    # Stub: add a placeholder item
    TradingManager.add_to_offer("potion", 1)
    _refresh_display()

func _on_trade_started() -> void:
    _confirmed = false
    _refresh_display()

func _on_trade_cancelled() -> void:
    visible = false

func _on_trade_completed(_my_items: Array, _their_items: Array) -> void:
    status_label.text = "Trade complete!"
    await get_tree().create_timer(1.5).timeout
    visible = false

func _on_offer_updated(_player_id: int, _items: Array) -> void:
    _refresh_display()

func _on_trade_confirmed(_player_id: int) -> void:
    _refresh_display()

func _input(event: InputEvent) -> void:
    if not visible:
        return
    
    if event.is_action_pressed("ui_cancel"):
        _on_cancel()
        get_viewport().set_input_as_handled()
