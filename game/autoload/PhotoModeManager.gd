extends Node
## Global photo mode manager - handles screenshot capture feature
## Supports hiding UI, taking photos, and saving to gallery

signal photo_mode_entered
signal photo_mode_exited
signal photo_taken(path: String)
signal ui_hidden
signal ui_shown

var _is_active: bool = false
var _ui_hidden: bool = false
var _photo_mode_ui: Node = null
var _hidden_ui_nodes: Array[Node] = []
var _photo_count: int = 0
var _gallery_dir: String = "user://photos/"


func _ready() -> void:
    _ensure_gallery_dir()


func _ensure_gallery_dir() -> void:
    var dir := DirAccess.open("user://")
    if dir != null and not dir.dir_exists("photos"):
        dir.make_dir("photos")


## Register the photo mode UI instance (called by PhotoModeUI on _ready)
func register_ui(ui: Node) -> void:
    _photo_mode_ui = ui


## Enter photo mode
func enter_photo_mode() -> void:
    if _is_active:
        return
    
    _is_active = true
    
    # Pause the game
    get_tree().paused = true
    
    if _photo_mode_ui != null:
        _photo_mode_ui.show_photo_mode()
    
    photo_mode_entered.emit()


## Exit photo mode
func exit_photo_mode() -> void:
    if not _is_active:
        return
    
    # Show UI if hidden
    if _ui_hidden:
        show_ui()
    
    _is_active = false
    
    # Resume the game
    get_tree().paused = false
    
    if _photo_mode_ui != null:
        _photo_mode_ui.hide_photo_mode()
    
    photo_mode_exited.emit()


## Hide all game UI for clean screenshot
func hide_ui() -> void:
    if _ui_hidden:
        return
    
    _ui_hidden = true
    _hidden_ui_nodes.clear()
    
    # Find and hide all CanvasLayer nodes that are UI elements
    # We look for nodes that are visible and are CanvasLayers (except the photo mode UI itself)
    var root := get_tree().root
    _hide_ui_recursive(root)
    
    ui_hidden.emit()


func _hide_ui_recursive(node: Node) -> void:
    if node == _photo_mode_ui:
        return  # Don't hide our own UI
    
    if node is CanvasLayer:
        var canvas := node as CanvasLayer
        # Skip layers less than 10 (assume these are game layers, not UI)
        if canvas.layer >= 10 and canvas.visible:
            canvas.visible = false
            _hidden_ui_nodes.append(node)
    
    for child in node.get_children():
        _hide_ui_recursive(child)


## Show all game UI again
func show_ui() -> void:
    if not _ui_hidden:
        return
    
    for node in _hidden_ui_nodes:
        if is_instance_valid(node) and node is CanvasLayer:
            (node as CanvasLayer).visible = true
    
    _hidden_ui_nodes.clear()
    _ui_hidden = false
    
    ui_shown.emit()


## Toggle UI visibility
func toggle_ui() -> void:
    if _ui_hidden:
        show_ui()
    else:
        hide_ui()


## Take a screenshot and save it
func take_photo() -> String:
    _photo_count += 1
    var timestamp := int(Time.get_unix_time_from_system())
    var filename := "photo_%d_%d.png" % [timestamp, _photo_count]
    var path := _gallery_dir + filename
    
    # Get the viewport image
    var viewport := get_viewport()
    if viewport == null:
        push_warning("PhotoModeManager: Could not get viewport for screenshot")
        return ""
    
    # Wait for the next frame to ensure render is complete
    await get_tree().process_frame
    
    var image := viewport.get_texture().get_image()
    if image == null:
        push_warning("PhotoModeManager: Could not get viewport image")
        return ""
    
    # Save the image
    var error := image.save_png(path)
    if error != OK:
        push_warning("PhotoModeManager: Failed to save photo: " + str(error))
        return ""
    
    print("[PhotoMode] Saved photo: " + path)
    photo_taken.emit(path)
    return path


## Check if photo mode is active
func is_active() -> bool:
    return _is_active


## Check if UI is hidden
func is_ui_hidden() -> bool:
    return _ui_hidden


## Get the gallery directory path
func get_gallery_path() -> String:
    return _gallery_dir


## Get list of all saved photos
func get_saved_photos() -> Array[String]:
    var photos: Array[String] = []
    var dir := DirAccess.open(_gallery_dir)
    if dir == null:
        return photos
    
    dir.list_dir_begin()
    var file_name := dir.get_next()
    while file_name != "":
        if not dir.current_is_dir() and file_name.ends_with(".png"):
            photos.append(_gallery_dir + file_name)
        file_name = dir.get_next()
    dir.list_dir_end()
    
    photos.sort()
    return photos


## Get photo count
func get_photo_count() -> int:
    return get_saved_photos().size()
