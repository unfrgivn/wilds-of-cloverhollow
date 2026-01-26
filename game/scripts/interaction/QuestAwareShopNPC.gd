extends Area2D

## QuestAwareShopNPC - Shopkeeper that gives a quest and provides shop with discount after completion

signal interaction_started
signal interaction_ended

## Quest configuration
@export var quest_id: String = ""
@export var dialogue_offer: String = "I have a problem..."
@export var dialogue_accepted: String = "Thank you!"
@export var dialogue_in_progress: String = "How's it going?"
@export var dialogue_ready_to_complete: String = "You did it!"
@export var dialogue_completed: String = "Thanks again!"
@export var completion_check_flag: String = ""

## Shop configuration
@export var shop_items: Array[String] = ["potion", "ether", "antidote"]
@export var discount_percent: int = 20

## Player's gold (placeholder - eventually move to InventoryManager)
var player_gold: int = 500

## Reference to shop UI
var shop_ui: Node = null

func _ready() -> void:
	await get_tree().process_frame
	shop_ui = get_tree().get_first_node_in_group("shop_ui")
	if shop_ui:
		shop_ui.purchase_requested.connect(_on_purchase_requested)
		shop_ui.shop_closed.connect(_on_shop_closed)

func interact() -> void:
	interaction_started.emit()
	
	# If quest is completed, open shop with discount
	if quest_id.is_empty() or QuestManager.is_quest_completed(quest_id):
		_open_shop_with_discount()
		return
	
	# If quest is active and completion check passes, complete it
	if QuestManager.is_quest_active(quest_id):
		if completion_check_flag.is_empty() or InventoryManager.has_story_flag(completion_check_flag):
			DialogueManager.show_dialogue(dialogue_ready_to_complete)
			await get_tree().create_timer(0.1).timeout
			QuestManager.complete_objective(quest_id, 1)  # "Report back" objective
			_open_shop_with_discount()
		else:
			DialogueManager.show_dialogue(dialogue_in_progress)
		return
	
	# Offer quest
	DialogueManager.show_dialogue(dialogue_offer)
	await get_tree().create_timer(0.1).timeout
	QuestManager.start_quest(quest_id)
	DialogueManager.show_dialogue(dialogue_accepted)

func _open_shop_with_discount() -> void:
	print("[QuestAwareShopNPC] Opening shop with %d%% discount" % (discount_percent if QuestManager.is_quest_completed(quest_id) else 0))
	
	if shop_ui:
		var has_discount := QuestManager.is_quest_completed(quest_id)
		shop_ui.open_shop(shop_items, player_gold, discount_percent if has_discount else 0)
	else:
		DialogueManager.show_dialogue("Welcome to my shop! (Shop UI not found)")

func _on_purchase_requested(item_id: String, price: int) -> void:
	var final_price := price
	if QuestManager.is_quest_completed(quest_id):
		final_price = int(price * (100 - discount_percent) / 100.0)
	
	if player_gold >= final_price:
		player_gold -= final_price
		InventoryManager.add_item(item_id, 1)
		print("[QuestAwareShopNPC] Purchased %s for %d gold (was %d). Remaining: %d" % [item_id, final_price, price, player_gold])
		if shop_ui:
			shop_ui.update_gold(player_gold)
			var msg := "Bought 1x %s!" % item_id
			if QuestManager.is_quest_completed(quest_id):
				msg += " (%d%% discount!)" % discount_percent
			shop_ui.show_message(msg)
	else:
		print("[QuestAwareShopNPC] Not enough gold for %s" % item_id)
		if shop_ui:
			shop_ui.show_message("Not enough gold!")

func _on_shop_closed() -> void:
	interaction_ended.emit()
	print("[QuestAwareShopNPC] Shop closed")

func end_interaction() -> void:
	if shop_ui and shop_ui.visible:
		shop_ui.close_shop()
	interaction_ended.emit()
