extends CanvasLayer
class_name ClawGame
## Playable claw machine mini-game

signal game_finished(won_prize: String)

# Game states
enum State { MOVING, DROPPING, GRABBING, RISING, RETURNING, DONE }

# Configuration
const CLAW_SPEED: float = 200.0
const DROP_SPEED: float = 150.0
const RISE_SPEED: float = 100.0
const GRAB_CHANCE: float = 0.7  # 70% chance to successfully grab
const PLAY_COST: int = 1  # Cost in candy

# Boundaries (relative to game area)
const LEFT_BOUND: float = 80.0
const RIGHT_BOUND: float = 560.0
const TOP_Y: float = 80.0
const BOTTOM_Y: float = 320.0
const DROP_ZONE_X: float = 520.0  # Where prizes are dropped

# Prize types with soft pastel colors matching the art style
const PRIZES: Array[Dictionary] = [
	{"id": "plush_bear", "name": "Teddy Bear", "color": Color(0.95, 0.75, 0.70)},  # Soft pink-brown
	{"id": "plush_bunny", "name": "Pink Bunny", "color": Color(1.0, 0.82, 0.86)},  # Soft pink
	{"id": "plush_cat", "name": "Mint Cat", "color": Color(0.75, 0.92, 0.85)},     # Soft mint
	{"id": "plush_dino", "name": "Lavender Dino", "color": Color(0.85, 0.78, 0.95)}, # Soft lavender
	{"id": "plush_star", "name": "Cream Star", "color": Color(1.0, 0.95, 0.80)},   # Soft cream yellow
	{"id": "plush_blob", "name": "Blue Blob", "color": Color(0.78, 0.85, 0.95)},   # Soft blue
]

# State
var current_state: State = State.MOVING
var claw_position: Vector2 = Vector2(320, TOP_Y)
var held_prize: Dictionary = {}
var prizes_in_machine: Array[Dictionary] = []
var target_drop_y: float = BOTTOM_Y

# Nodes (created in _ready)
var game_panel: Panel
var claw_sprite: Panel
var claw_arm: Line2D
var prizes_container: Control
var instruction_label: Label
var result_label: Label
var cost_label: Label


var _input_ready: bool = false  # Prevents input from previous interaction


func _ready() -> void:
	layer = 110  # Above UIRoot
	_build_ui()
	_spawn_prizes()
	_update_instruction("← → Move   |   Z Drop   |   X Quit")
	
	# Wait for player to release interact key before accepting input
	# This prevents the claw from immediately dropping
	await get_tree().process_frame
	await get_tree().create_timer(0.1).timeout
	_input_ready = true


func _build_ui() -> void:
	# --- ART DIRECTION CONSTANTS (Soft Pastel Dreamy Style) ---
	var c_lavender := Color(0.75, 0.68, 0.88)       # Soft purple-lavender
	var c_lavender_dark := Color(0.55, 0.48, 0.72) # Darker lavender for frame
	var c_pink_soft := Color(0.95, 0.80, 0.85)     # Soft pink
	var c_cream := Color(0.98, 0.96, 0.94)         # Warm cream
	var c_mint_soft := Color(0.78, 0.92, 0.88)     # Soft mint
	var c_yellow_soft := Color(1.0, 0.92, 0.75)    # Soft warm yellow
	var c_blue_soft := Color(0.82, 0.88, 0.95)     # Soft blue
	
	# --- MAIN OVERLAY ---
	var overlay := ColorRect.new()
	overlay.color = Color(0.4, 0.35, 0.5, 0.75)  # Soft purple-tinted overlay
	overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)
	
	# --- MAIN GAME PANEL (THE MACHINE) ---
	game_panel = Panel.new()
	game_panel.custom_minimum_size = Vector2(640, 480)
	game_panel.set_anchors_preset(Control.PRESET_CENTER)
	game_panel.position = Vector2(-320, -240)
	add_child(game_panel)
	
	# Style: Soft lavender body, no harsh outlines
	var style_machine := StyleBoxFlat.new()
	style_machine.bg_color = c_lavender
	style_machine.set_corner_radius_all(24)
	style_machine.shadow_color = Color(0.4, 0.3, 0.5, 0.3)
	style_machine.shadow_size = 12
	style_machine.shadow_offset = Vector2(0, 6)
	game_panel.add_theme_stylebox_override("panel", style_machine)
	
	# --- DECORATIVE LIGHT BULBS around frame ---
	_add_light_bulbs(game_panel)
	
	# --- HEADER ---
	var header_panel := Panel.new()
	header_panel.position = Vector2(40, 20)
	header_panel.size = Vector2(560, 45)
	var style_header := StyleBoxFlat.new()
	style_header.bg_color = c_lavender_dark
	style_header.set_corner_radius_all(12)
	header_panel.add_theme_stylebox_override("panel", style_header)
	game_panel.add_child(header_panel)
	
	# Title
	var title := Label.new()
	title.text = "✦ CLAW MACHINE ✦"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title.set_anchors_preset(Control.PRESET_FULL_RECT)
	title.add_theme_color_override("font_color", c_cream)
	title.add_theme_font_size_override("font_size", 22)
	header_panel.add_child(title)
	
	# --- PLAY AREA WINDOW ---
	var window_frame := Panel.new()
	window_frame.position = Vector2(40, 75)
	window_frame.size = Vector2(560, 295)
	var style_frame := StyleBoxFlat.new()
	style_frame.bg_color = c_lavender_dark
	style_frame.set_corner_radius_all(16)
	window_frame.add_theme_stylebox_override("panel", style_frame)
	game_panel.add_child(window_frame)
	
	# The Glass/Play area itself
	var play_area := Panel.new()
	play_area.position = Vector2(8, 8)
	play_area.size = Vector2(544, 279)
	var style_glass := StyleBoxFlat.new()
	style_glass.bg_color = c_blue_soft
	style_glass.set_corner_radius_all(12)
	play_area.add_theme_stylebox_override("panel", style_glass)
	window_frame.add_child(play_area)
	
	# Background image with decorative plushies
	var bg_texture := load("res://assets/minigames/claw_machine_bg.png") as Texture2D
	if bg_texture:
		var bg_image := TextureRect.new()
		bg_image.texture = bg_texture
		bg_image.position = Vector2(0, 0)
		bg_image.size = Vector2(544, 279)
		bg_image.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg_image.z_index = 0
		play_area.add_child(bg_image)
	
	# Soft glass reflection
	var reflection := ColorRect.new()
	reflection.color = Color(1, 1, 1, 0.15)
	reflection.rotation_degrees = 20
	reflection.position = Vector2(380, -30)
	reflection.size = Vector2(30, 350)
	play_area.add_child(reflection)
	
	# PRIZES CONTAINER
	prizes_container = Control.new()
	prizes_container.position = Vector2(40, 90)
	prizes_container.z_index = 5
	game_panel.add_child(prizes_container)
	
	# CLAW ARM (rope/chain)
	claw_arm = Line2D.new()
	claw_arm.width = 4.0
	claw_arm.default_color = Color(0.7, 0.65, 0.75)  # Soft lavender-gray
	claw_arm.z_index = 15
	game_panel.add_child(claw_arm)
	
	# CLAW HEAD - soft pink claw
	claw_sprite = Panel.new()
	claw_sprite.size = Vector2(30, 24)
	claw_sprite.z_index = 15
	var style_claw := StyleBoxFlat.new()
	style_claw.bg_color = c_pink_soft
	style_claw.set_corner_radius_all(6)
	style_claw.corner_radius_bottom_left = 12
	style_claw.corner_radius_bottom_right = 12
	claw_sprite.add_theme_stylebox_override("panel", style_claw)
	game_panel.add_child(claw_sprite)
	
	# Claw prongs
	var prong_left := Panel.new()
	prong_left.size = Vector2(6, 14)
	prong_left.position = Vector2(3, 20)
	var style_prong := StyleBoxFlat.new()
	style_prong.bg_color = c_pink_soft.darkened(0.1)
	style_prong.set_corner_radius_all(3)
	prong_left.add_theme_stylebox_override("panel", style_prong)
	claw_sprite.add_child(prong_left)
	
	var prong_right := Panel.new()
	prong_right.size = Vector2(6, 14)
	prong_right.position = Vector2(21, 20)
	prong_right.add_theme_stylebox_override("panel", style_prong)
	claw_sprite.add_child(prong_right)
	
	# --- BOTTOM SECTION: Drop Zone + Controls ---
	# Drop zone indicator
	var drop_zone_panel := Panel.new()
	drop_zone_panel.position = Vector2(480, 75)
	drop_zone_panel.size = Vector2(110, 295)
	var style_drop := StyleBoxFlat.new()
	style_drop.bg_color = c_mint_soft.darkened(0.05)
	style_drop.set_corner_radius_all(12)
	drop_zone_panel.add_theme_stylebox_override("panel", style_drop)
	game_panel.add_child(drop_zone_panel)
	
	var drop_label := Label.new()
	drop_label.text = "PRIZE\nDROP"
	drop_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	drop_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	drop_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	drop_label.add_theme_color_override("font_color", c_lavender_dark)
	drop_label.add_theme_font_size_override("font_size", 14)
	drop_zone_panel.add_child(drop_label)
	
	# --- INSTRUCTION/STATUS LABELS ---
	instruction_label = Label.new()
	instruction_label.position = Vector2(40, 385)
	instruction_label.size = Vector2(400, 30)
	instruction_label.add_theme_color_override("font_color", c_cream)
	instruction_label.add_theme_font_size_override("font_size", 16)
	game_panel.add_child(instruction_label)
	
	result_label = Label.new()
	result_label.position = Vector2(40, 415)
	result_label.size = Vector2(400, 30)
	result_label.add_theme_color_override("font_color", c_yellow_soft)
	result_label.add_theme_font_size_override("font_size", 18)
	result_label.visible = false
	game_panel.add_child(result_label)
	
	# Cost display
	cost_label = Label.new()
	cost_label.position = Vector2(450, 440)
	cost_label.size = Vector2(150, 30)
	cost_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	cost_label.text = "Cost: %d Candy" % PLAY_COST
	cost_label.add_theme_color_override("font_color", c_pink_soft)
	cost_label.add_theme_font_size_override("font_size", 14)
	game_panel.add_child(cost_label)


func _add_light_bulbs(parent: Panel) -> void:
	# Add decorative light bulbs around the machine frame
	var bulb_colors: Array[Color] = [
		Color(1.0, 0.85, 0.9),   # Pink
		Color(0.9, 1.0, 0.85),   # Mint
		Color(1.0, 0.95, 0.8),   # Yellow
		Color(0.9, 0.9, 1.0),    # Light blue
		Color(1.0, 1.0, 1.0),    # White
	]
	
	# Top row
	for i in range(12):
		var bulb := Panel.new()
		bulb.size = Vector2(12, 12)
		bulb.position = Vector2(45 + i * 46, 5)
		var style := StyleBoxFlat.new()
		style.bg_color = bulb_colors[i % bulb_colors.size()]
		style.set_corner_radius_all(6)
		bulb.add_theme_stylebox_override("panel", style)
		parent.add_child(bulb)
	
	# Bottom row
	for i in range(12):
		var bulb := Panel.new()
		bulb.size = Vector2(12, 12)
		bulb.position = Vector2(45 + i * 46, 463)
		var style := StyleBoxFlat.new()
		style.bg_color = bulb_colors[(i + 2) % bulb_colors.size()]
		style.set_corner_radius_all(6)
		bulb.add_theme_stylebox_override("panel", style)
		parent.add_child(bulb)
	
	# Left column
	for i in range(8):
		var bulb := Panel.new()
		bulb.size = Vector2(12, 12)
		bulb.position = Vector2(8, 60 + i * 50)
		var style := StyleBoxFlat.new()
		style.bg_color = bulb_colors[(i + 1) % bulb_colors.size()]
		style.set_corner_radius_all(6)
		bulb.add_theme_stylebox_override("panel", style)
		parent.add_child(bulb)
	
	# Right column
	for i in range(8):
		var bulb := Panel.new()
		bulb.size = Vector2(12, 12)
		bulb.position = Vector2(620, 60 + i * 50)
		var style := StyleBoxFlat.new()
		style.bg_color = bulb_colors[(i + 3) % bulb_colors.size()]
		style.set_corner_radius_all(6)
		bulb.add_theme_stylebox_override("panel", style)
		parent.add_child(bulb)


func _spawn_prizes() -> void:
	# Spawn 8-12 random prizes
	var prize_count := randi_range(8, 12)
	for i in range(prize_count):
		var prize_data := PRIZES[randi() % PRIZES.size()].duplicate()
		prize_data["x"] = randf_range(LEFT_BOUND + 20, DROP_ZONE_X - 40)
		prize_data["y"] = randf_range(250, 310)
		prizes_in_machine.append(prize_data)
		
		# Create visual - SOFT PASTEL PLUSHIES (no harsh outlines)
		var prize_visual := Node2D.new()
		prize_visual.position = Vector2(prize_data["x"] - 18, prize_data["y"] - 18)
		prize_visual.name = "Prize_%d" % i
		prize_visual.z_index = 10  # Above background
		
		# Soft plushie body - no outline, just soft pastel color
		var plush_shape := Panel.new()
		plush_shape.size = Vector2(36, 36)
		plush_shape.position = Vector2(0, 0)
		var style_plush := StyleBoxFlat.new()
		style_plush.bg_color = prize_data["color"]
		style_plush.set_corner_radius_all(18)  # Fully rounded
		# Soft subtle shadow instead of outline
		style_plush.shadow_color = Color(0.6, 0.5, 0.7, 0.25)
		style_plush.shadow_size = 3
		style_plush.shadow_offset = Vector2(1, 2)
		plush_shape.add_theme_stylebox_override("panel", style_plush)
		prize_visual.add_child(plush_shape)
		
		# Soft dot eyes - slightly darker than body, not black
		var eye_color: Color = (prize_data["color"] as Color).darkened(0.4)
		
		var eye_left := Panel.new()
		eye_left.size = Vector2(5, 5)
		eye_left.position = Vector2(9, 12)
		var style_eye := StyleBoxFlat.new()
		style_eye.bg_color = eye_color
		style_eye.set_corner_radius_all(3)
		eye_left.add_theme_stylebox_override("panel", style_eye)
		plush_shape.add_child(eye_left)
		
		var eye_right := Panel.new()
		eye_right.size = Vector2(5, 5)
		eye_right.position = Vector2(22, 12)
		eye_right.add_theme_stylebox_override("panel", style_eye)
		plush_shape.add_child(eye_right)
		
		# Tiny blush marks - soft pink circles
		var blush_left := Panel.new()
		blush_left.size = Vector2(6, 4)
		blush_left.position = Vector2(5, 18)
		var style_blush := StyleBoxFlat.new()
		style_blush.bg_color = Color(1.0, 0.7, 0.75, 0.5)
		style_blush.set_corner_radius_all(2)
		blush_left.add_theme_stylebox_override("panel", style_blush)
		plush_shape.add_child(blush_left)
		
		var blush_right := Panel.new()
		blush_right.size = Vector2(6, 4)
		blush_right.position = Vector2(25, 18)
		blush_right.add_theme_stylebox_override("panel", style_blush)
		plush_shape.add_child(blush_right)
		
		prizes_container.add_child(prize_visual)



func _process(delta: float) -> void:
	match current_state:
		State.MOVING:
			_handle_moving(delta)
		State.DROPPING:
			_handle_dropping(delta)
		State.GRABBING:
			_handle_grabbing()
		State.RISING:
			_handle_rising(delta)
		State.RETURNING:
			_handle_returning(delta)
		State.DONE:
			_handle_done()
	
	_update_claw_visual()


func _handle_moving(delta: float) -> void:
	if not _input_ready:
		return
	
	if Input.is_action_pressed("move_left"):
		claw_position.x -= CLAW_SPEED * delta
	if Input.is_action_pressed("move_right"):
		claw_position.x += CLAW_SPEED * delta
	
	claw_position.x = clampf(claw_position.x, LEFT_BOUND, RIGHT_BOUND)
	
	if Input.is_action_just_pressed("interact"):
		current_state = State.DROPPING
		_update_instruction("Dropping...")
	
	if Input.is_action_just_pressed("cancel"):
		_end_game("")


func _handle_dropping(delta: float) -> void:
	claw_position.y += DROP_SPEED * delta
	
	if claw_position.y >= target_drop_y:
		claw_position.y = target_drop_y
		current_state = State.GRABBING


func _handle_grabbing() -> void:
	# Check for prize collision
	var grabbed := _try_grab_prize()
	
	if grabbed:
		# Random chance to actually hold the prize
		if randf() <= GRAB_CHANCE:
			_update_instruction("Got something!")
		else:
			# Prize slips!
			held_prize = {}
			_update_instruction("It slipped!")
	else:
		_update_instruction("Nothing there...")
	
	current_state = State.RISING


func _try_grab_prize() -> bool:
	# Claw grabs prizes that are near/below it when it reaches the bottom
	# The claw "scoops" - check area below and around the claw position
	var grab_zone := Rect2(claw_position.x - 25, claw_position.y - 50, 50, 60)
	
	for i in range(prizes_in_machine.size()):
		var prize := prizes_in_machine[i]
		var prize_center := Vector2(prize["x"], prize["y"])
		
		if grab_zone.has_point(prize_center):
			held_prize = prize.duplicate()
			held_prize["index"] = i
			return true
	
	return false


func _handle_rising(delta: float) -> void:
	claw_position.y -= RISE_SPEED * delta
	
	# Move held prize with claw
	if not held_prize.is_empty():
		var prize_node := prizes_container.get_node_or_null("Prize_%d" % held_prize["index"])
		if prize_node:
			prize_node.position = Vector2(claw_position.x - 20, claw_position.y + 15)
	
	if claw_position.y <= TOP_Y:
		claw_position.y = TOP_Y
		current_state = State.RETURNING
		_update_instruction("Returning to drop zone...")


func _handle_returning(delta: float) -> void:
	# Move toward drop zone
	var target_x := DROP_ZONE_X + 50
	var direction: float = signf(target_x - claw_position.x)
	claw_position.x += direction * CLAW_SPEED * delta
	
	# Move held prize with claw
	if not held_prize.is_empty():
		var prize_node := prizes_container.get_node_or_null("Prize_%d" % held_prize["index"])
		if prize_node:
			prize_node.position = Vector2(claw_position.x - 20, claw_position.y + 15)
	
	if absf(claw_position.x - target_x) < 5.0:
		claw_position.x = target_x
		current_state = State.DONE


func _handle_done() -> void:
	if not held_prize.is_empty():
		# Drop the prize animation
		var prize_node := prizes_container.get_node_or_null("Prize_%d" % held_prize["index"])
		if prize_node:
			# Animate it falling
			var tween := create_tween()
			tween.tween_property(prize_node, "position:y", 350.0, 0.3)
			await tween.finished
		
		# Success! 
		_show_result("YOU WON: %s!" % held_prize["name"], Color(0.3, 1.0, 0.3))
		
		# Remove from machine
		prizes_in_machine.remove_at(held_prize["index"])
		if prize_node:
			prize_node.queue_free()
		
		await get_tree().create_timer(2.0).timeout
		_end_game(held_prize["id"])
	else:
		_show_result("No prize this time...", Color(1.0, 0.5, 0.5))
		await get_tree().create_timer(1.5).timeout
		_end_game("")


func _update_claw_visual() -> void:
	# Offset for play area (40, 90)
	# Claw center is claw_position.x
	# Claw visual top-left is x-20
	var offset := Vector2(40, 90)
	
	# Update claw position
	claw_sprite.position = claw_position - Vector2(20, 0) + offset
	
	# Update arm
	# Arm starts at top of play area (y=0 in logic, y=90 in visual)
	# Arm ends at claw top (y=claw_position.y)
	claw_arm.clear_points()
	# Top point: (claw_x, 0) + offset -> but visually at top of glass
	# Logic y starts at TOP_Y = 80.
	# Wait, logic y is actual y position. 
	# If logic y=80, and offset is 90, visual y = 170.
	# The arm should extend from the top of the glass.
	# Top of glass is y=90 (relative to game_panel).
	# Claw attach point is claw_position.y + offset.y
	
	# Anchor point (rail):
	claw_arm.add_point(Vector2(claw_position.x + offset.x, offset.y))
	# Claw point:
	claw_arm.add_point(Vector2(claw_position.x + offset.x, claw_position.y + offset.y))


func _update_instruction(text: String) -> void:
	instruction_label.text = text


func _show_result(text: String, color: Color) -> void:
	result_label.text = text
	result_label.add_theme_color_override("font_color", color)
	result_label.visible = true


func _end_game(prize_id: String) -> void:
	game_finished.emit(prize_id)
	queue_free()
