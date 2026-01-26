extends CanvasLayer

## MapScreenUI - Town map display with current location marker and building labels

signal map_closed

var _is_active: bool = false
var _current_area: String = ""

# Building locations on map (pixel positions relative to 256x192 map)
# These map area scene names to their map coordinates
const BUILDING_POSITIONS: Dictionary = {
    "Area_TownCenter": Vector2(128, 96),
    "Area_HeroHouse": Vector2(38, 95),
    "Area_HeroHouseInterior": Vector2(38, 95),
    "Area_HeroHouseUpper": Vector2(38, 95),
    "Area_School": Vector2(205, 60),
    "Area_SchoolHall": Vector2(205, 60),
    "Area_SchoolClassroom": Vector2(205, 60),
    "Area_Arcade": Vector2(200, 130),
    "Area_ArcadeInterior": Vector2(200, 130),
    "Area_GeneralStore": Vector2(90, 145),
    "Area_Library": Vector2(75, 50),
    "Area_Cafe": Vector2(160, 48),
    "Area_CafeInterior": Vector2(160, 48),
    "Area_TownHall": Vector2(38, 158),
    "Area_TownHallInterior": Vector2(38, 158),
    "Area_PetShop": Vector2(218, 23),
    "Area_PetShopInterior": Vector2(218, 23),
    "Area_Blacksmith": Vector2(130, 165),
    "Area_BlacksmithInterior": Vector2(130, 165),
    "Area_Clinic": Vector2(183, 173),
    "Area_ClinicInterior": Vector2(183, 173),
    "Area_TownPark": Vector2(235, 108),
}

# Building labels to display
const BUILDING_LABELS: Dictionary = {
    "Area_TownCenter": "Town Center",
    "Area_HeroHouse": "Home",
    "Area_School": "School",
    "Area_Arcade": "Arcade",
    "Area_GeneralStore": "Store",
    "Area_Library": "Library",
    "Area_Cafe": "Cafe",
    "Area_TownHall": "Town Hall",
    "Area_PetShop": "Pet Shop",
    "Area_Blacksmith": "Blacksmith",
    "Area_Clinic": "Clinic",
    "Area_TownPark": "Park",
}

@onready var panel: Panel = $Panel
@onready var title_label: Label = $Panel/TitleLabel
@onready var map_rect: ColorRect = $Panel/MapContainer/MapTexture
@onready var marker: ColorRect = $Panel/MapContainer/Marker
@onready var labels_container: Control = $Panel/MapContainer/LabelsContainer
@onready var location_label: Label = $Panel/LocationLabel
@onready var dimmer: ColorRect = $Dimmer

func _ready() -> void:
    add_to_group("map_screen_ui")
    visible = false
    process_mode = Node.PROCESS_MODE_ALWAYS
    _create_building_labels()

func _input(event: InputEvent) -> void:
    if not _is_active:
        return
    
    if event.is_action_pressed("ui_cancel") or event.is_action_pressed("pause"):
        close_map()
        get_viewport().set_input_as_handled()

func open_map() -> void:
    _is_active = true
    visible = true
    _update_current_location()
    _update_marker()
    print("[MapScreenUI] Opened")

func close_map() -> void:
    _is_active = false
    visible = false
    map_closed.emit()
    print("[MapScreenUI] Closed")

func _update_current_location() -> void:
    # Get current scene name from SceneRouter or tree
    var current_scene = get_tree().current_scene
    if current_scene:
        _current_area = current_scene.name
    else:
        _current_area = "Area_TownCenter"
    
    # Update location label
    var display_name = BUILDING_LABELS.get(_current_area, _current_area.replace("Area_", "").replace("_", " "))
    location_label.text = "Current: " + display_name

func _update_marker() -> void:
    # Position marker on map based on current area
    var pos = BUILDING_POSITIONS.get(_current_area, Vector2(128, 96))
    
    # Offset to center the marker (marker is 8x8)
    marker.position = pos - Vector2(4, 4)
    marker.visible = true

func _create_building_labels() -> void:
    # Clear existing labels
    for child in labels_container.get_children():
        child.queue_free()
    
    # Create label for each building
    for area_name in BUILDING_LABELS:
        var pos = BUILDING_POSITIONS.get(area_name, Vector2.ZERO)
        var label_text = BUILDING_LABELS[area_name]
        
        var label = Label.new()
        label.text = label_text
        label.add_theme_font_size_override("font_size", 8)
        label.add_theme_color_override("font_color", Color(0.1, 0.1, 0.1))
        label.add_theme_color_override("font_shadow_color", Color(1, 1, 1, 0.8))
        label.add_theme_constant_override("shadow_offset_x", 1)
        label.add_theme_constant_override("shadow_offset_y", 1)
        
        # Position label near building (offset below)
        label.position = pos + Vector2(-20, 8)
        labels_container.add_child(label)
