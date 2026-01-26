extends Area2D

## ShopNPC - Shopkeeper that opens the shop UI on interaction

signal interaction_started
signal interaction_ended

## Items available for purchase (item_id from items.json)
@export var shop_items: Array[String] = ["potion", "ether", "antidote"]

## Player's gold (placeholder - eventually move to InventoryManager)
var player_gold: int = 500

## Reference to shop UI (set when scene loads)
var shop_ui: Node = null

func _ready() -> void:
	# Find ShopUI in the scene tree
	await get_tree().process_frame
	shop_ui = get_tree().get_first_node_in_group("shop_ui")
	if shop_ui:
		shop_ui.purchase_requested.connect(_on_purchase_requested)
		shop_ui.shop_closed.connect(_on_shop_closed)

## Called when the player interacts with this NPC
func interact() -> void:
	interaction_started.emit()
	print("[ShopNPC] Opening shop with %d items" % shop_items.size())
	
	if shop_ui:
		shop_ui.open_shop(shop_items, player_gold)
	else:
		# Fallback if no ShopUI found
		DialogueManager.show_dialogue("Welcome to my shop! (Shop UI not found)")

## Handle purchase request from ShopUI
func _on_purchase_requested(item_id: String, price: int) -> void:
	if player_gold >= price:
		player_gold -= price
		InventoryManager.add_item(item_id, 1)
		print("[ShopNPC] Purchased %s for %d gold. Remaining: %d" % [item_id, price, player_gold])
		if shop_ui:
			shop_ui.update_gold(player_gold)
			shop_ui.show_message("Bought 1x %s!" % item_id)
	else:
		print("[ShopNPC] Not enough gold for %s" % item_id)
		if shop_ui:
			shop_ui.show_message("Not enough gold!")

## Handle shop close
func _on_shop_closed() -> void:
	interaction_ended.emit()
	print("[ShopNPC] Shop closed")

## Called when interaction ends
func end_interaction() -> void:
	if shop_ui and shop_ui.visible:
		shop_ui.close_shop()
	interaction_ended.emit()
