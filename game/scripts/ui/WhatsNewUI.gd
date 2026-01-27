extends CanvasLayer

## WhatsNewUI - Shows patch notes/what's new on version update

signal notes_dismissed

var _is_active: bool = false

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var notes_container: VBoxContainer = $Panel/ScrollContainer/NotesContainer
@onready var dismiss_button: Button = $Panel/DismissButton
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
    visible = false
    process_mode = Node.PROCESS_MODE_ALWAYS
    
    PatchNotesManager.register_ui(self)
    dismiss_button.pressed.connect(_on_dismiss)
    print("[WhatsNewUI] Initialized")

func show_notes(notes_data: Dictionary) -> void:
    _is_active = true
    visible = true
    
    # Set title
    title_label.text = notes_data.get("title", "What's New")
    
    # Clear existing notes
    for child in notes_container.get_children():
        child.queue_free()
    
    # Add note items
    var notes: Array = notes_data.get("notes", [])
    for note in notes:
        var item := Label.new()
        item.text = "• " + str(note)
        item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        notes_container.add_child(item)
    
    dismiss_button.grab_focus()
    SFXManager.play_menu_select()
    print("[WhatsNewUI] Showing notes")

func hide_notes() -> void:
    _is_active = false
    visible = false
    notes_dismissed.emit()
    print("[WhatsNewUI] Hidden")

func _on_dismiss() -> void:
    SFXManager.play_menu_select()
    PatchNotesManager.dismiss_patch_notes()

func _input(event: InputEvent) -> void:
    if not _is_active:
        return
    
    if event.is_action_pressed("interact") or event.is_action_pressed("ui_accept") or event.is_action_pressed("ui_cancel"):
        _on_dismiss()
        get_viewport().set_input_as_handled()
