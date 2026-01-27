extends CanvasLayer
## PhotoModeUI - Photo mode controls overlay
## Shows camera button, hide UI toggle, and exit button

@onready var controls_panel: PanelContainer = $ControlsPanel
@onready var photo_button: Button = $ControlsPanel/VBox/PhotoButton
@onready var hide_ui_button: Button = $ControlsPanel/VBox/HideUIButton
@onready var stickers_button: Button = $ControlsPanel/VBox/StickersButton
@onready var exit_button: Button = $ControlsPanel/VBox/ExitButton
@onready var photo_flash: ColorRect = $PhotoFlash
@onready var photo_count_label: Label = $PhotoCountLabel

var _is_visible: bool = false
var _sticker_ui: Node = null
const STICKER_UI_PATH := "res://game/scenes/ui/PhotoStickerUI.tscn"


func _ready() -> void:
    PhotoModeManager.register_ui(self)
    
    photo_button.pressed.connect(_on_photo_pressed)
    hide_ui_button.pressed.connect(_on_hide_ui_pressed)
    stickers_button.pressed.connect(_on_stickers_pressed)
    exit_button.pressed.connect(_on_exit_pressed)
    
    PhotoModeManager.ui_hidden.connect(_on_ui_hidden)
    PhotoModeManager.ui_shown.connect(_on_ui_shown)
    PhotoModeManager.photo_taken.connect(_on_photo_taken)
    
    hide_photo_mode()


func _input(event: InputEvent) -> void:
    if not _is_visible:
        return
    
    # Handle cancel to exit photo mode
    if event.is_action_pressed("cancel"):
        PhotoModeManager.exit_photo_mode()
        get_viewport().set_input_as_handled()
        return
    
    # Handle accept/interact to take photo
    if event.is_action_pressed("accept") or event.is_action_pressed("interact"):
        _take_photo()
        get_viewport().set_input_as_handled()


## Show the photo mode UI
func show_photo_mode() -> void:
    _is_visible = true
    visible = true
    controls_panel.visible = true
    photo_flash.visible = false
    photo_flash.modulate.a = 0
    _update_ui_button_text()
    _update_photo_count()


## Hide the photo mode UI
func hide_photo_mode() -> void:
    _is_visible = false
    visible = false


func _on_photo_pressed() -> void:
    _take_photo()


func _take_photo() -> void:
    # Hide controls temporarily for screenshot
    var controls_were_visible := controls_panel.visible
    controls_panel.visible = false
    photo_count_label.visible = false
    
    # Wait one frame for the UI to actually hide
    await get_tree().process_frame
    
    # Take the photo
    var path := await PhotoModeManager.take_photo()
    
    # Show flash effect
    if path != "":
        _play_flash_effect()
    
    # Restore controls
    controls_panel.visible = controls_were_visible and not PhotoModeManager.is_ui_hidden()
    photo_count_label.visible = controls_panel.visible
    _update_photo_count()


func _play_flash_effect() -> void:
    photo_flash.visible = true
    photo_flash.modulate.a = 1.0
    
    var tween := create_tween()
    tween.tween_property(photo_flash, "modulate:a", 0.0, 0.3)
    tween.tween_callback(func(): photo_flash.visible = false)


func _on_hide_ui_pressed() -> void:
    PhotoModeManager.toggle_ui()


func _on_exit_pressed() -> void:
    PhotoModeManager.exit_photo_mode()


func _on_stickers_pressed() -> void:
    _open_sticker_mode()


func _open_sticker_mode() -> void:
    # Hide photo mode UI
    controls_panel.visible = false
    photo_count_label.visible = false
    
    # Load and show sticker UI
    if _sticker_ui == null and ResourceLoader.exists(STICKER_UI_PATH):
        var sticker_scene := load(STICKER_UI_PATH)
        _sticker_ui = sticker_scene.instantiate()
        get_tree().root.add_child(_sticker_ui)
        _sticker_ui.decoration_cancelled.connect(_on_sticker_cancelled)
        _sticker_ui.decoration_saved.connect(_on_sticker_saved)
    
    if _sticker_ui != null:
        _sticker_ui.show_sticker_ui()


func _on_sticker_cancelled() -> void:
    _close_sticker_mode()


func _on_sticker_saved(_path: String) -> void:
    _update_photo_count()


func _close_sticker_mode() -> void:
    # Show photo mode UI again
    controls_panel.visible = true
    photo_count_label.visible = true


func _on_ui_hidden() -> void:
    controls_panel.visible = false
    photo_count_label.visible = false
    _update_ui_button_text()


func _on_ui_shown() -> void:
    controls_panel.visible = true
    photo_count_label.visible = true
    _update_ui_button_text()


func _on_photo_taken(_path: String) -> void:
    _update_photo_count()


func _update_ui_button_text() -> void:
    if PhotoModeManager.is_ui_hidden():
        hide_ui_button.text = "Show UI"
    else:
        hide_ui_button.text = "Hide UI"


func _update_photo_count() -> void:
    var count := PhotoModeManager.get_photo_count()
    photo_count_label.text = "Photos: %d" % count
