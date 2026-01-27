extends CanvasLayer

## UpdatePromptUI - Shows when an update is available

signal update_dismissed
signal update_accepted

var _is_active: bool = false

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var message_label: Label = $Panel/MessageLabel
@onready var version_label: Label = $Panel/VersionLabel
@onready var update_button: Button = $Panel/UpdateButton
@onready var dismiss_button: Button = $Panel/DismissButton
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
    visible = false
    process_mode = Node.PROCESS_MODE_ALWAYS
    
    update_button.pressed.connect(_on_update)
    dismiss_button.pressed.connect(_on_dismiss)
    print("[UpdatePromptUI] Initialized")

func show_update(current_version: String, latest_version: String) -> void:
    _is_active = true
    visible = true
    
    version_label.text = "v%s → v%s" % [current_version, latest_version]
    title_label.text = "Update Available!"
    message_label.text = "A new version is available.\nWould you like to update?"
    
    update_button.grab_focus()
    SFXManager.play_menu_select()
    print("[UpdatePromptUI] Showing update prompt")

func hide_prompt() -> void:
    _is_active = false
    visible = false
    print("[UpdatePromptUI] Hidden")

func _on_update() -> void:
    SFXManager.play_menu_select()
    UpdateNotificationManager.open_store()
    update_accepted.emit()
    hide_prompt()

func _on_dismiss() -> void:
    SFXManager.play_menu_cancel()
    update_dismissed.emit()
    hide_prompt()

func _input(event: InputEvent) -> void:
    if not _is_active:
        return
    
    if event.is_action_pressed("ui_cancel"):
        _on_dismiss()
        get_viewport().set_input_as_handled()
