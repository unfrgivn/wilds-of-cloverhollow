extends CanvasLayer
## CollectionLogUI - Displays collection progress across categories with milestones

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var category_tabs: HBoxContainer = $Panel/CategoryTabs
@onready var item_list: VBoxContainer = $Panel/ScrollContainer/ItemList
@onready var progress_label: Label = $Panel/ProgressLabel
@onready var overall_progress_label: Label = $Panel/OverallProgressLabel
@onready var milestone_panel: Panel = $Panel/MilestonePanel
@onready var milestone_label: Label = $Panel/MilestonePanel/MilestoneLabel
@onready var claim_button: Button = $Panel/MilestonePanel/ClaimButton
@onready var close_button: Button = $Panel/CloseButton

var _current_category: String = ""
var _categories: Array = []

func _ready() -> void:
    visible = false
    close_button.pressed.connect(_on_close)
    claim_button.pressed.connect(_on_claim_milestone)

func show_collection_log() -> void:
    visible = true
    _categories = CollectionLogManager.get_categories()
    if _categories.size() > 0:
        _current_category = _categories[0].get("id", "")
    _build_tabs()
    _refresh_display()

func _build_tabs() -> void:
    # Clear existing tabs
    for child in category_tabs.get_children():
        child.queue_free()
    
    # Create tab for each category
    for cat in _categories:
        var btn := Button.new()
        btn.text = cat.get("name", "???")
        btn.custom_minimum_size.x = 60
        var cat_id: String = cat.get("id", "")
        btn.pressed.connect(_on_tab_pressed.bind(cat_id))
        category_tabs.add_child(btn)

func _on_tab_pressed(category_id: String) -> void:
    _current_category = category_id
    _refresh_display()

func _refresh_display() -> void:
    # Clear existing items
    for child in item_list.get_children():
        child.queue_free()
    
    # Get items for current category
    var all_items: Array = CollectionLogManager.get_category_items(_current_category)
    var collected_count := CollectionLogManager.get_collected_count(_current_category)
    var total_count := all_items.size()
    var completion := CollectionLogManager.get_completion_percent(_current_category)
    
    # Update progress labels
    progress_label.text = "%s: %d / %d (%.0f%%)" % [
        _get_category_name(_current_category),
        collected_count,
        total_count,
        completion
    ]
    
    var overall_completion := CollectionLogManager.get_overall_completion_percent()
    overall_progress_label.text = "Overall: %.0f%%" % overall_completion
    
    # Create entry for each item
    for item in all_items:
        var item_id: String = item.get("id", "")
        var item_name: String = item.get("name", "???")
        var is_collected := CollectionLogManager.is_item_collected(_current_category, item_id)
        var count := CollectionLogManager.get_item_collected_count(_current_category, item_id)
        
        var entry := HBoxContainer.new()
        entry.custom_minimum_size.y = 24
        
        # Collection indicator
        var icon := ColorRect.new()
        icon.custom_minimum_size = Vector2(16, 16)
        icon.color = Color(0.2, 0.6, 0.2) if is_collected else Color(0.3, 0.3, 0.3)
        entry.add_child(icon)
        
        # Name (hidden if not collected)
        var name_label := Label.new()
        if is_collected:
            name_label.text = " %s x%d" % [item_name, count]
        else:
            name_label.text = " ???"
        entry.add_child(name_label)
        
        item_list.add_child(entry)
    
    # Update milestone panel
    _refresh_milestones()

func _refresh_milestones() -> void:
    var claimable := CollectionLogManager.get_claimable_milestones(_current_category)
    if claimable.size() > 0:
        var next_ms: int = claimable[0]
        milestone_label.text = "%d%% Milestone Ready!" % next_ms
        claim_button.visible = true
        claim_button.text = "Claim"
    else:
        # Show next milestone target
        var completion := CollectionLogManager.get_completion_percent(_current_category)
        var next_target := 100
        for ms in CollectionLogManager.get_milestones():
            var percent: int = ms.get("percent", 0)
            if percent > completion:
                next_target = percent
                break
        milestone_label.text = "Next: %d%% (%.0f%% done)" % [next_target, completion]
        claim_button.visible = false

func _get_category_name(category_id: String) -> String:
    for cat in _categories:
        if cat.get("id") == category_id:
            return cat.get("name", "???")
    return "???"

func _on_claim_milestone() -> void:
    var claimable := CollectionLogManager.get_claimable_milestones(_current_category)
    if claimable.size() > 0:
        var reward := CollectionLogManager.claim_milestone(_current_category, claimable[0])
        if reward.size() > 0:
            var gold: int = reward.get("reward_gold", 0)
            NotificationManager.show_notification(
                "Milestone Claimed!",
                "Received %d gold!" % gold,
                NotificationManager.NotificationType.ACHIEVEMENT
            )
    _refresh_milestones()

func _on_close() -> void:
    visible = false

func _input(event: InputEvent) -> void:
    if not visible:
        return
    
    if event.is_action_pressed("ui_cancel"):
        _on_close()
        get_viewport().set_input_as_handled()
