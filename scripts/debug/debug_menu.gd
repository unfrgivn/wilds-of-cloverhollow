extends CanvasLayer
## Debug menu for jumping between scenes
## Toggle with F2, select scene and spawn point, press Enter to teleport

# Scene registry: scene_key -> { path, spawns }
const SCENES: Dictionary = {
	"cloverhollow_town": {
		"path": "res://scenes/locations/cloverhollow_town.tscn",
		"spawns": ["Default", "FromFaeHouse", "FromSchool", "FromArcade", "FromCafe", "FromStore"]
	},
	"fae_bedroom": {
		"path": "res://scenes/locations/fae_bedroom.tscn",
		"spawns": ["Default", "FromHall"]
	},
	"fae_hall": {
		"path": "res://scenes/locations/fae_hall.tscn",
		"spawns": ["Default", "FromUpstairs", "FromTown"]
	},
	"fae_upstairs_hall": {
		"path": "res://scenes/locations/fae_upstairs_hall.tscn",
		"spawns": ["Default", "FromDownstairs", "FromFaeRoom", "FromOliverRoom"]
	},
	"oliver_room": {
		"path": "res://scenes/locations/oliver_room.tscn",
		"spawns": ["Default", "FromHall"]
	},
	"arcade": {
		"path": "res://scenes/locations/arcade.tscn",
		"spawns": ["Default", "FromTown"]
	},
	"school_hall": {
		"path": "res://scenes/locations/school_hall.tscn",
		"spawns": ["Default", "FromTown", "FromHomeroom", "FromMusic", "FromArt", "FromNurse", "FromStairs"]
	},
	"school_stairwell": {
		"path": "res://scenes/locations/school_stairwell.tscn",
		"spawns": ["Default", "FromFirstFloor", "FromSecondFloor", "FromPrincipal"]
	},
	"school_principal_office": {
		"path": "res://scenes/locations/school_principal_office.tscn",
		"spawns": ["Default", "FromHall"]
	},
	"school_nurse_office": {
		"path": "res://scenes/locations/school_nurse_office.tscn",
		"spawns": ["Default", "FromHall"]
	},
	"school_art_room": {
		"path": "res://scenes/locations/school_art_room.tscn",
		"spawns": ["Default", "FromHall"]
	},
	"school_music_room": {
		"path": "res://scenes/locations/school_music_room.tscn",
		"spawns": ["Default", "FromHall"]
	},
	"school_homeroom": {
		"path": "res://scenes/locations/school_homeroom.tscn",
		"spawns": ["Default", "FromHall"]
	},
}

var _enabled: bool = false
var _panel: PanelContainer
var _scene_list: ItemList
var _spawn_list: ItemList
var _status_label: Label
var _scene_keys: Array[String] = []
var _current_spawns: Array[String] = []


func _ready() -> void:
	layer = 100
	_build_ui()
	_populate_scenes()
	_panel.visible = false
	print("[DebugMenu] Press F2 to toggle scene jump menu")


func _build_ui() -> void:
	_panel = PanelContainer.new()
	_panel.name = "DebugPanel"
	
	# Style the panel
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.1, 0.15, 0.95)
	style.border_color = Color(0.4, 0.6, 0.9)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(12)
	_panel.add_theme_stylebox_override("panel", style)
	
	var main_vbox := VBoxContainer.new()
	main_vbox.add_theme_constant_override("separation", 8)
	
	# Title
	var title := Label.new()
	title.text = "🎮 DEBUG MENU (F2 to close)"
	title.add_theme_font_size_override("font_size", 18)
	title.add_theme_color_override("font_color", Color(0.9, 0.8, 0.3))
	main_vbox.add_child(title)
	
	# Instructions
	var instructions := Label.new()
	instructions.text = "↑↓ Navigate | Tab Switch List | Enter Teleport | Esc Close"
	instructions.add_theme_font_size_override("font_size", 12)
	instructions.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	main_vbox.add_child(instructions)
	
	# Horizontal container for the two lists
	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 16)
	
	# Scene list section
	var scene_vbox := VBoxContainer.new()
	var scene_label := Label.new()
	scene_label.text = "SCENES"
	scene_label.add_theme_color_override("font_color", Color(0.6, 0.9, 0.6))
	scene_vbox.add_child(scene_label)
	
	_scene_list = ItemList.new()
	_scene_list.custom_minimum_size = Vector2(220, 300)
	_scene_list.allow_reselect = true
	_scene_list.item_selected.connect(_on_scene_selected)
	scene_vbox.add_child(_scene_list)
	hbox.add_child(scene_vbox)
	
	# Spawn list section
	var spawn_vbox := VBoxContainer.new()
	var spawn_label := Label.new()
	spawn_label.text = "SPAWN POINTS"
	spawn_label.add_theme_color_override("font_color", Color(0.6, 0.8, 0.9))
	spawn_vbox.add_child(spawn_label)
	
	_spawn_list = ItemList.new()
	_spawn_list.custom_minimum_size = Vector2(180, 300)
	_spawn_list.allow_reselect = true
	spawn_vbox.add_child(_spawn_list)
	hbox.add_child(spawn_vbox)
	
	main_vbox.add_child(hbox)
	
	# Status label
	_status_label = Label.new()
	_status_label.text = "Select a scene to view spawn points"
	_status_label.add_theme_font_size_override("font_size", 12)
	_status_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.6))
	main_vbox.add_child(_status_label)
	
	_panel.add_child(main_vbox)
	add_child(_panel)
	
	# Position in top-left with margin
	_panel.position = Vector2(20, 20)


func _populate_scenes() -> void:
	_scene_keys.clear()
	_scene_list.clear()
	
	for key: String in SCENES.keys():
		_scene_keys.append(key)
		_scene_list.add_item(key.replace("_", " ").capitalize())
	
	if _scene_keys.size() > 0:
		_scene_list.select(0)
		_on_scene_selected(0)


func _on_scene_selected(index: int) -> void:
	if index < 0 or index >= _scene_keys.size():
		return
	
	var scene_key: String = _scene_keys[index]
	var scene_data: Dictionary = SCENES[scene_key]
	
	_spawn_list.clear()
	_current_spawns.clear()
	
	for spawn: String in scene_data["spawns"]:
		_current_spawns.append(spawn)
		_spawn_list.add_item(spawn)
	
	if _current_spawns.size() > 0:
		_spawn_list.select(0)
	
	_status_label.text = "Scene: %s (%d spawns)" % [scene_key, _current_spawns.size()]


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		# F2 toggles menu
		if event.keycode == KEY_F2 or event.physical_keycode == KEY_F2:
			_toggle_menu()
			get_viewport().set_input_as_handled()
			return
		
		if not _enabled:
			return
		
		# Escape closes menu
		if event.keycode == KEY_ESCAPE:
			_toggle_menu()
			get_viewport().set_input_as_handled()
			return
		
		# Tab switches between lists
		if event.keycode == KEY_TAB:
			if _scene_list.has_focus():
				_spawn_list.grab_focus()
			else:
				_scene_list.grab_focus()
			get_viewport().set_input_as_handled()
			return
		
		# Enter teleports
		if event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER:
			_teleport_to_selected()
			get_viewport().set_input_as_handled()
			return


func _toggle_menu() -> void:
	_enabled = not _enabled
	_panel.visible = _enabled
	
	if _enabled:
		_scene_list.grab_focus()
		# Pause the game tree while menu is open
		get_tree().paused = true
		process_mode = Node.PROCESS_MODE_ALWAYS
	else:
		get_tree().paused = false
	
	print("[DebugMenu] %s" % ("OPENED" if _enabled else "CLOSED"))


func _teleport_to_selected() -> void:
	var scene_idx: int = _scene_list.get_selected_items()[0] if _scene_list.get_selected_items().size() > 0 else -1
	var spawn_idx: int = _spawn_list.get_selected_items()[0] if _spawn_list.get_selected_items().size() > 0 else -1
	
	if scene_idx < 0:
		_status_label.text = "⚠️ No scene selected"
		return
	
	var scene_key: String = _scene_keys[scene_idx]
	var scene_path: String = SCENES[scene_key]["path"]
	var spawn_id: String = _current_spawns[spawn_idx] if spawn_idx >= 0 else "default"
	
	print("[DebugMenu] Teleporting to %s @ %s" % [scene_key, spawn_id])
	_status_label.text = "🚀 Teleporting to %s..." % scene_key
	
	# Close menu and unpause before transition
	_enabled = false
	_panel.visible = false
	get_tree().paused = false
	
	# Use SceneRouter for proper transition
	if SceneRouter:
		SceneRouter.go_to_scene(scene_path, spawn_id)
	else:
		push_error("[DebugMenu] SceneRouter not found!")
