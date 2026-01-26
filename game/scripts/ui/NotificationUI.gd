extends CanvasLayer
class_name NotificationUI

## NotificationUI - Displays toast notifications

@onready var panel: PanelContainer = $Panel
@onready var title_label: Label = $Panel/VBox/TitleLabel
@onready var message_label: Label = $Panel/VBox/MessageLabel
@onready var icon_rect: TextureRect = $Panel/HBox/IconRect

var _tween: Tween = null

func _ready() -> void:
    layer = 100  # Above everything
    panel.visible = false
    NotificationManager.register_ui(self)
    print("[NotificationUI] Ready")

func show_notification(notification: Dictionary) -> void:
    var title: String = notification.get("title", "")
    var message: String = notification.get("message", "")
    var icon: Texture2D = notification.get("icon", null)
    
    title_label.text = title
    message_label.text = message
    message_label.visible = message != ""
    
    if icon != null:
        icon_rect.texture = icon
        icon_rect.visible = true
    else:
        icon_rect.visible = false
    
    # Animate in
    panel.visible = true
    panel.modulate.a = 0.0
    panel.position.y = -50
    
    if _tween:
        _tween.kill()
    _tween = create_tween()
    _tween.set_parallel(true)
    _tween.tween_property(panel, "modulate:a", 1.0, 0.3)
    _tween.tween_property(panel, "position:y", 20, 0.3).set_ease(Tween.EASE_OUT)
    
    print("[NotificationUI] Showing: %s - %s" % [title, message])

func hide_notification() -> void:
    if _tween:
        _tween.kill()
    _tween = create_tween()
    _tween.set_parallel(true)
    _tween.tween_property(panel, "modulate:a", 0.0, 0.2)
    _tween.tween_property(panel, "position:y", -30, 0.2)
    _tween.chain().tween_callback(_on_hide_complete)

func _on_hide_complete() -> void:
    panel.visible = false
