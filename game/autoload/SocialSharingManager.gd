extends Node
## Global social sharing manager - handles screenshot sharing with branding
## Provides platform hooks for iOS share sheet integration

signal share_started
signal share_completed(success: bool)
signal share_cancelled
signal shareable_image_created(path: String)

# Share platforms (stub for future platform-specific handling)
enum Platform {
    NATIVE,      # iOS Share Sheet / Android Intent
    TWITTER,
    FACEBOOK,
    INSTAGRAM,
    CLIPBOARD
}

# Branding overlay settings
const BRANDING_TEXT: String = "Wilds of Cloverhollow"
const BRANDING_HASHTAG: String = "#WildsOfCloverhollow"
const WATERMARK_ALPHA: float = 0.7
const WATERMARK_PADDING: int = 8

var _share_dir: String = "user://shares/"
var _last_shared_path: String = ""
var _is_sharing: bool = false
var _share_history: Array[Dictionary] = []  # {timestamp, platform, path}


func _ready() -> void:
    _ensure_share_dir()


func _ensure_share_dir() -> void:
    var dir := DirAccess.open("user://")
    if dir != null and not dir.dir_exists("shares"):
        dir.make_dir("shares")


## Generate a shareable image from current viewport with branding overlay
func create_shareable_image(include_branding: bool = true) -> String:
    var timestamp := int(Time.get_unix_time_from_system())
    var filename := "share_%d.png" % timestamp
    var path := _share_dir + filename
    
    # Get the viewport image
    var viewport := get_viewport()
    if viewport == null:
        push_warning("[SocialSharing] Could not get viewport for screenshot")
        return ""
    
    # Wait for the next frame to ensure render is complete
    await get_tree().process_frame
    
    var image := viewport.get_texture().get_image()
    if image == null:
        push_warning("[SocialSharing] Could not get viewport image")
        return ""
    
    # Add branding overlay if requested
    if include_branding:
        _add_branding_overlay(image)
    
    # Save the image
    var error := image.save_png(path)
    if error != OK:
        push_warning("[SocialSharing] Failed to save shareable image: " + str(error))
        return ""
    
    print("[SocialSharing] Created shareable image: " + path)
    _last_shared_path = path
    shareable_image_created.emit(path)
    return path


## Add branding watermark to image (bottom-right corner)
func _add_branding_overlay(image: Image) -> void:
    # Simple text watermark - we'll draw a semi-transparent bar at the bottom
    var width := image.get_width()
    var height := image.get_height()
    
    # Draw a subtle watermark bar at bottom
    var bar_height := 16
    var bar_y := height - bar_height
    
    # Semi-transparent dark bar
    for y in range(bar_y, height):
        for x in range(width):
            var pixel := image.get_pixel(x, y)
            # Blend with dark color for watermark area
            var dark := Color(0.1, 0.1, 0.15, 1.0)
            var blended := pixel.lerp(dark, 0.5)
            image.set_pixel(x, y, blended)
    
    # Note: Godot 4 doesn't have built-in text drawing on Images
    # In production, we'd use a pre-rendered watermark sprite
    # For now, the dark bar serves as a visual indicator


## Share an image using native platform sharing
func share_image(image_path: String, message: String = "") -> void:
    if _is_sharing:
        push_warning("[SocialSharing] Share already in progress")
        return
    
    if image_path.is_empty():
        push_warning("[SocialSharing] No image path provided")
        share_completed.emit(false)
        return
    
    _is_sharing = true
    share_started.emit()
    
    var share_message := message
    if share_message.is_empty():
        share_message = "Check out my adventure in %s! %s" % [BRANDING_TEXT, BRANDING_HASHTAG]
    
    # Record share attempt
    _record_share(Platform.NATIVE, image_path)
    
    # STUB: In production, this would call iOS native share sheet
    # For iOS: Use a GDExtension or native plugin to invoke UIActivityViewController
    # For now, we just log and emit success
    print("[SocialSharing] Share requested (stub)")
    print("[SocialSharing] Image: " + image_path)
    print("[SocialSharing] Message: " + share_message)
    
    # Simulate successful share
    _is_sharing = false
    share_completed.emit(true)


## Share current screen (takes screenshot, adds branding, shares)
func share_current_screen(message: String = "") -> void:
    var path := await create_shareable_image(true)
    if path.is_empty():
        share_completed.emit(false)
        return
    
    share_image(path, message)


## Share an existing photo from photo mode
func share_photo(photo_path: String, message: String = "") -> void:
    share_image(photo_path, message)


## Copy image path to clipboard (for manual sharing)
func copy_to_clipboard(text: String) -> void:
    DisplayServer.clipboard_set(text)
    _record_share(Platform.CLIPBOARD, text)
    print("[SocialSharing] Copied to clipboard: " + text)


## Get default share message
func get_default_message() -> String:
    return "Check out my adventure in %s! %s" % [BRANDING_TEXT, BRANDING_HASHTAG]


## Get share history
func get_share_history() -> Array[Dictionary]:
    return _share_history


## Clear share history
func clear_history() -> void:
    _share_history.clear()


## Record a share attempt
func _record_share(platform: Platform, path: String) -> void:
    var entry := {
        "timestamp": int(Time.get_unix_time_from_system()),
        "platform": platform,
        "path": path
    }
    _share_history.append(entry)
    
    # Keep history limited
    while _share_history.size() > 50:
        _share_history.pop_front()


## Get last shared image path
func get_last_shared_path() -> String:
    return _last_shared_path


## Check if sharing is in progress
func is_sharing() -> bool:
    return _is_sharing


## Get platform name for display
func get_platform_name(platform: Platform) -> String:
    match platform:
        Platform.NATIVE:
            return "Share"
        Platform.TWITTER:
            return "Twitter"
        Platform.FACEBOOK:
            return "Facebook"
        Platform.INSTAGRAM:
            return "Instagram"
        Platform.CLIPBOARD:
            return "Clipboard"
        _:
            return "Unknown"


## Cancel current share (if possible)
func cancel_share() -> void:
    if _is_sharing:
        _is_sharing = false
        share_cancelled.emit()


## Get all shareable images in share directory
func get_shareable_images() -> Array[String]:
    var images: Array[String] = []
    var dir := DirAccess.open(_share_dir)
    if dir == null:
        return images
    
    dir.list_dir_begin()
    var file_name := dir.get_next()
    while file_name != "":
        if not dir.current_is_dir() and file_name.ends_with(".png"):
            images.append(_share_dir + file_name)
        file_name = dir.get_next()
    dir.list_dir_end()
    
    images.sort()
    return images


## Delete old shareable images (cleanup)
func cleanup_old_shares(max_age_seconds: int = 86400) -> int:
    var now := int(Time.get_unix_time_from_system())
    var deleted := 0
    var dir := DirAccess.open(_share_dir)
    if dir == null:
        return 0
    
    var to_delete: Array[String] = []
    dir.list_dir_begin()
    var file_name := dir.get_next()
    while file_name != "":
        if not dir.current_is_dir() and file_name.ends_with(".png"):
            # Extract timestamp from filename (share_TIMESTAMP.png)
            var parts := file_name.replace(".png", "").split("_")
            if parts.size() >= 2:
                var file_time := parts[1].to_int()
                if now - file_time > max_age_seconds:
                    to_delete.append(file_name)
        file_name = dir.get_next()
    dir.list_dir_end()
    
    for fname in to_delete:
        dir.remove(fname)
        deleted += 1
    
    if deleted > 0:
        print("[SocialSharing] Cleaned up %d old share images" % deleted)
    
    return deleted


## Reset manager state (for testing)
func reset() -> void:
    _is_sharing = false
    _last_shared_path = ""
    _share_history.clear()
