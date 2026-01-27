extends Node

## MerchandiseManager - Handles external merchandise shop links (stub)
## This is a placeholder for future merchandise integration

signal shop_opened(category: String)
signal shop_closed
signal link_clicked(link_id: String, url: String)

## Shop categories and placeholder URLs
const SHOP_CATEGORIES: Dictionary = {
    "all": {
        "name": "Cloverhollow Shop",
        "url": "https://shop.cloverhollow.example.com/",
        "description": "Official Cloverhollow merchandise"
    },
    "apparel": {
        "name": "Apparel",
        "url": "https://shop.cloverhollow.example.com/apparel",
        "description": "T-shirts, hoodies, and more"
    },
    "plushies": {
        "name": "Plushies",
        "url": "https://shop.cloverhollow.example.com/plushies",
        "description": "Cuddly pet and character plushies"
    },
    "accessories": {
        "name": "Accessories",
        "url": "https://shop.cloverhollow.example.com/accessories",
        "description": "Pins, stickers, and keychains"
    }
}

## Promotional items that could unlock in-game content
const PROMO_ITEMS: Array[Dictionary] = [
    {
        "id": "launch_bundle",
        "name": "Launch Bundle",
        "description": "Special launch edition bundle with exclusive in-game outfit code",
        "url": "https://shop.cloverhollow.example.com/launch-bundle",
        "unlocks_outfit": "launch_celebration_outfit"
    }
]

var _shop_enabled: bool = true
var _last_opened_category: String = ""
var _link_history: Array[Dictionary] = []

func _ready() -> void:
    print("[MerchandiseManager] Merchandise integration stub initialized")

## Opens the external shop in the device browser
## category: The shop category to open (default: "all")
func open_shop(category: String = "all") -> bool:
    if not _shop_enabled:
        push_warning("[MerchandiseManager] Shop is disabled")
        return false
    
    if not SHOP_CATEGORIES.has(category):
        push_warning("[MerchandiseManager] Unknown category: %s" % category)
        return false
    
    var shop_data: Dictionary = SHOP_CATEGORIES[category]
    var url: String = shop_data["url"]
    
    _last_opened_category = category
    _record_link_click("shop_%s" % category, url)
    
    # Stub: In production, this would use OS.shell_open(url)
    print("[MerchandiseManager] Opening shop: %s -> %s" % [category, url])
    _simulate_open_url(url)
    
    shop_opened.emit(category)
    return true

## Opens a specific promotional item link
func open_promo_item(promo_id: String) -> bool:
    for item in PROMO_ITEMS:
        if item["id"] == promo_id:
            var url: String = item["url"]
            _record_link_click("promo_%s" % promo_id, url)
            print("[MerchandiseManager] Opening promo: %s -> %s" % [promo_id, url])
            _simulate_open_url(url)
            link_clicked.emit("promo_%s" % promo_id, url)
            return true
    
    push_warning("[MerchandiseManager] Unknown promo item: %s" % promo_id)
    return false

## Opens a custom external URL (for partner links, social media, etc.)
func open_external_link(link_id: String, url: String) -> void:
    _record_link_click(link_id, url)
    print("[MerchandiseManager] Opening external link: %s -> %s" % [link_id, url])
    _simulate_open_url(url)
    link_clicked.emit(link_id, url)

## Simulate opening a URL (stub - in production uses OS.shell_open)
func _simulate_open_url(url: String) -> void:
    # In production: OS.shell_open(url)
    # Stub just logs the action
    pass

## Record link clicks for analytics
func _record_link_click(link_id: String, url: String) -> void:
    var click_data := {
        "link_id": link_id,
        "url": url,
        "timestamp": Time.get_unix_time_from_system()
    }
    _link_history.append(click_data)
    
    # Cap history at 100 entries
    if _link_history.size() > 100:
        _link_history.pop_front()

## Get shop categories for UI
func get_shop_categories() -> Array[String]:
    var categories: Array[String] = []
    for key in SHOP_CATEGORIES.keys():
        categories.append(key)
    return categories

## Get category data
func get_category_data(category: String) -> Dictionary:
    if SHOP_CATEGORIES.has(category):
        return SHOP_CATEGORIES[category]
    return {}

## Get promotional items
func get_promo_items() -> Array[Dictionary]:
    return PROMO_ITEMS

## Get last opened category
func get_last_opened_category() -> String:
    return _last_opened_category

## Get link click history
func get_link_history() -> Array[Dictionary]:
    return _link_history

## Clear link history
func clear_link_history() -> void:
    _link_history.clear()

## Enable/disable shop
func set_shop_enabled(enabled: bool) -> void:
    _shop_enabled = enabled
    print("[MerchandiseManager] Shop enabled: %s" % enabled)

## Check if shop is enabled
func is_shop_enabled() -> bool:
    return _shop_enabled

## Reset to initial state (for testing)
func reset() -> void:
    _last_opened_category = ""
    _link_history.clear()
    _shop_enabled = true
    print("[MerchandiseManager] Reset")
