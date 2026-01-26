extends CanvasLayer
## AchievementPopupUI - Displays achievement unlock notifications
## Shows achievement name, description, and points earned

@onready var popup_panel: PanelContainer = $PopupPanel
@onready var icon_label: Label = $PopupPanel/HBox/IconLabel
@onready var name_label: Label = $PopupPanel/HBox/VBox/NameLabel
@onready var description_label: Label = $PopupPanel/HBox/VBox/DescriptionLabel
@onready var points_label: Label = $PopupPanel/HBox/PointsLabel

var _is_showing: bool = false
var _queue: Array[Dictionary] = []


func _ready() -> void:
    AchievementManager.register_popup_ui(self)
    _hide_popup()


## Show an achievement popup
func show_achievement(achievement: Dictionary) -> void:
    _queue.append(achievement)
    if not _is_showing:
        _show_next()


func _show_next() -> void:
    if _queue.is_empty():
        _is_showing = false
        return
    
    _is_showing = true
    var achievement: Dictionary = _queue.pop_front()
    
    # Set content
    icon_label.text = _get_icon_emoji(achievement.get("icon", "star"))
    name_label.text = achievement.get("name", "Achievement Unlocked!")
    description_label.text = achievement.get("description", "")
    points_label.text = "+%d" % achievement.get("points", 0)
    
    # Show with animation
    popup_panel.visible = true
    popup_panel.modulate.a = 0
    popup_panel.position.y = -50
    
    var tween := create_tween()
    tween.tween_property(popup_panel, "modulate:a", 1.0, 0.3)
    tween.parallel().tween_property(popup_panel, "position:y", 10, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
    
    # Hold for 3 seconds
    tween.tween_interval(3.0)
    
    # Hide
    tween.tween_property(popup_panel, "modulate:a", 0.0, 0.3)
    tween.parallel().tween_property(popup_panel, "position:y", -50, 0.3)
    
    # Show next or finish
    tween.tween_callback(_on_popup_hidden)


func _on_popup_hidden() -> void:
    _hide_popup()
    _show_next()


func _hide_popup() -> void:
    popup_panel.visible = false


func _get_icon_emoji(icon: String) -> String:
    match icon:
        "footprints":
            return "👣"
        "compass":
            return "🧭"
        "chat":
            return "💬"
        "sword":
            return "⚔️"
        "scroll":
            return "📜"
        "trophy":
            return "🏆"
        "toolbox":
            return "🧰"
        "camera":
            return "📷"
        "star":
            return "⭐"
        "magnifier":
            return "🔍"
        _:
            return "🎖️"
