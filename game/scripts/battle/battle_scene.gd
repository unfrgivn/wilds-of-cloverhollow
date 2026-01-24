extends Node2D

@export var return_scene := ""

const BattleActor = preload("res://game/scripts/battle/battle_actor.gd")
const BattleState = preload("res://game/scripts/battle/battle_state.gd")
const BattleBackgroundLoader = preload("res://game/scripts/battle/battle_background_loader.gd")
const SPRITE_LOADER = preload("res://game/scripts/exploration/sprite_frames_loader.gd")
const CHARACTER_SPRITE_DIR := "res://game/assets/sprites/characters"
const ENEMY_SPRITE_DIR := "res://game/assets/sprites/enemies"
const ACTION_DELAY := 0.5

var _battle_state
var _pending_actions: Array = []
var _sprite_loader = SPRITE_LOADER.new()

@onready var _game_state = get_node_or_null("/root/GameState")
@onready var _data_registry = get_node_or_null("/root/DataRegistry")
@onready var _encounter_manager = get_node_or_null("/root/EncounterManager")
@onready var _enemy_list: VBoxContainer = $CanvasLayer/SafeArea/HudStack/TopHud/EnemyPanel/EnemyList
@onready var _party_list: Container = $CanvasLayer/SafeArea/HudStack/TopHud/PartyPanel/PartyList
@onready var _info_label: Label = $CanvasLayer/SafeArea/HudStack/BottomHud/InfoPanel/InfoLabel
@onready var _command_menu: GridContainer = $CanvasLayer/SafeArea/HudStack/BottomHud/ControlsRow/CommandPanel/CommandGrid
@onready var _submenu_panel: PanelContainer = $CanvasLayer/SafeArea/HudStack/BottomHud/ControlsRow/SubMenuPanel
@onready var _submenu_list: VBoxContainer = $CanvasLayer/SafeArea/HudStack/BottomHud/ControlsRow/SubMenuPanel/SubMenuList
@onready var _target_cursor: Label = $CanvasLayer/BattlerLayer/TargetCursor
@onready var _background_rect: TextureRect = $CanvasLayer/Background
@onready var _foreground_rect: TextureRect = $CanvasLayer/Foreground
@onready var _enemy_sprites: Array[AnimatedSprite2D] = [
	$CanvasLayer/BattlerLayer/EnemySpriteA,
	$CanvasLayer/BattlerLayer/EnemySpriteB,
]
@onready var _party_sprites: Array[AnimatedSprite2D] = [
	$CanvasLayer/BattlerLayer/PartySprite1,
	$CanvasLayer/BattlerLayer/PartySprite2,
	$CanvasLayer/BattlerLayer/PartySprite3,
	$CanvasLayer/BattlerLayer/PartySprite4,
]


func _ready() -> void:
	if return_scene.is_empty() and _game_state != null:
		return_scene = String(_game_state.get_value("return_scene", ""))
	if _game_state != null:
		_game_state.input_blocked = true
		_game_state.set_value("battle_turn_complete", false)

	_battle_state = BattleState.new()
	_battle_state.setup(_build_party(), _build_enemies())
	_wire_command_buttons()
	_close_submenu()
	_load_background()
	_load_battler_sprites()
	_refresh_hud()
	_update_info("Choose a command.")


func select_battle_command(command_id: String, target_index: int = -1) -> void:
	if _battle_state == null:
		return
	_close_submenu()
	var accepted = _battle_state.select_command(command_id, target_index)
	if not accepted:
		_update_info("Command ignored.")
		return
	_refresh_hud()
	_update_info(_battle_state.last_log)
	_play_actions(_battle_state.last_actions)
	if not _battle_state.result.is_empty():
		_finish_battle(_battle_state.result)


func _wire_command_buttons() -> void:
	for child in _command_menu.get_children():
		if child is Button:
			var command_id = _command_id_for_button(child)
			child.pressed.connect(_on_command_pressed.bind(command_id))


func _open_target_menu(command_id: String) -> void:
	if _battle_state == null or _submenu_panel == null or _submenu_list == null:
		select_battle_command(command_id)
		return
	_close_submenu()
	var indices = _active_enemy_indices()
	if indices.is_empty():
		select_battle_command(command_id)
		return
	_submenu_panel.visible = true
	for idx in indices:
		var actor = _battle_state.enemies[idx]
		var button = Button.new()
		button.text = actor.display_name
		button.pressed.connect(_on_target_selected.bind(command_id, idx))
		button.focus_entered.connect(_on_target_hovered.bind(idx))
		button.mouse_entered.connect(_on_target_hovered.bind(idx))
		_submenu_list.add_child(button)
	_on_target_hovered(indices[0])
	_update_info("Select a target.")


func _active_enemy_indices() -> Array[int]:
	var indices: Array[int] = []
	if _battle_state == null:
		return indices
	for i in range(_battle_state.enemies.size()):
		if _battle_state.enemies[i].is_alive():
			indices.append(i)
	return indices


func _on_target_selected(command_id: String, target_index: int) -> void:
	_close_submenu()
	select_battle_command(command_id, target_index)


func _on_target_hovered(target_index: int) -> void:
	_position_target_cursor(true, target_index)


func _close_submenu() -> void:
	if _submenu_panel != null:
		_submenu_panel.visible = false
	if _submenu_list != null:
		for child in _submenu_list.get_children():
			child.queue_free()
	if _target_cursor != null:
		_target_cursor.visible = false


func _position_target_cursor(is_enemy: bool, index: int) -> void:
	if _target_cursor == null:
		return
	var sprites = _enemy_sprites if is_enemy else _party_sprites
	if index < 0 or index >= sprites.size():
		_target_cursor.visible = false
		return
	var sprite = sprites[index]
	if sprite == null:
		_target_cursor.visible = false
		return
	_target_cursor.visible = true
	_target_cursor.global_position = sprite.global_position + Vector2(0, -40)


func _command_id_for_button(button: Button) -> String:
	var name = button.name.to_lower()
	if name.contains("attack"):
		return "attack"
	if name.contains("skills"):
		return "skills"
	if name.contains("items"):
		return "items"
	if name.contains("defend"):
		return "defend"
	if name.contains("run"):
		return "run"
	return name


func _on_command_pressed(command_id: String) -> void:
	if command_id == "attack" or command_id == "skills":
		_open_target_menu(command_id)
		return
	select_battle_command(command_id)


func _build_party() -> Array:
	_ensure_data_loaded()
	var ids: Array[String] = []
	if _game_state != null:
		ids = _game_state.get_party()
	if ids.is_empty():
		ids = ["fae", "sue", "jordan", "maddie"]
	var party_members: Array = []
	for member_id in ids:
		var member_def = _get_party_def(member_id)
		if member_def != null:
			party_members.append(BattleActor.new(member_def.id, member_def.display_name, member_def.max_hp, member_def.max_mp, false))
		else:
			var display_name = member_id.capitalize()
			party_members.append(BattleActor.new(member_id, display_name, 12, 6, false))
		if party_members.size() >= 4:
			break
	return party_members


func _build_enemies() -> Array:
	_ensure_data_loaded()
	var enemies: Array = []
	var encounter_id = _current_encounter_id()
	var encounter = _get_encounter_def(encounter_id)
	if encounter != null and encounter.enemy_ids.size() > 0:
		for enemy_id in encounter.enemy_ids:
			var enemy_def = _get_enemy_def(enemy_id)
			if enemy_def != null:
				enemies.append(BattleActor.new(enemy_def.id, enemy_def.display_name, enemy_def.max_hp, enemy_def.max_mp, true))
	if enemies.is_empty():
		enemies.append(BattleActor.new("enemy_slime", "Slime A", 9, 0, true))
		enemies.append(BattleActor.new("enemy_slime", "Slime B", 9, 0, true))
	return enemies


func _current_encounter_id() -> String:
	var encounter_id = ""
	if _game_state != null:
		encounter_id = String(_game_state.get_value("encounter_id", ""))
	return encounter_id


func _load_background() -> void:
	if _background_rect != null:
		_background_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_background_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	if _foreground_rect != null:
		_foreground_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_foreground_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED

	var encounter_id = _current_encounter_id()
	var encounter = _get_encounter_def(encounter_id)
	var biome_id = ""
	var background_id = ""
	if encounter != null:
		biome_id = String(encounter.biome_id)
		background_id = String(encounter.battle_background_id)

	var loader = BattleBackgroundLoader.new()
	var result = loader.load_background(biome_id, background_id)
	_apply_background(result)


func _apply_background(result: Dictionary) -> void:
	if _background_rect != null:
		var bg = result.get("bg", null)
		if bg != null:
			_background_rect.texture = bg
			_background_rect.visible = true
		else:
			_background_rect.visible = false
	if _foreground_rect != null:
		var fg = result.get("fg", null)
		if fg != null:
			_foreground_rect.texture = fg
			_foreground_rect.visible = true
		else:
			_foreground_rect.visible = false


func _load_battler_sprites() -> void:
	_assign_battler_sprites(_party_sprites, _battle_state.party)
	_assign_battler_sprites(_enemy_sprites, _battle_state.enemies)
	_play_idle_all()


func _assign_battler_sprites(sprites: Array, actors: Array) -> void:
	for i in range(sprites.size()):
		var sprite = sprites[i]
		if sprite == null:
			continue
		if i >= actors.size():
			sprite.visible = false
			continue
		var actor = actors[i]
		var frames = _load_battle_frames(actor)
		if frames == null:
			sprite.visible = false
			continue
		sprite.sprite_frames = frames
		sprite.visible = true


func _load_battle_frames(actor: BattleActor) -> SpriteFrames:
	if actor == null:
		return null
	var base_dir = ENEMY_SPRITE_DIR if actor.is_enemy else CHARACTER_SPRITE_DIR
	var sprite_path = "%s/%s" % [base_dir, actor.id]
	return _sprite_loader.build_battle_frames(sprite_path, actor.id)


func _play_actions(actions: Array) -> void:
	if actions.is_empty():
		return
	_pending_actions = actions.duplicate()
	_play_next_action()


func _play_next_action() -> void:
	if _pending_actions.is_empty():
		_play_idle_all()
		return
	var action = _pending_actions.pop_front()
	_play_action(action)
	var timer = get_tree().create_timer(ACTION_DELAY)
	timer.timeout.connect(_play_next_action)


func _play_action(action: Dictionary) -> void:
	var verb = String(action.get("verb", "attack"))
	var attack_anim = "attack" if verb == "skill" else verb
	_play_battler_anim(action, true, attack_anim)
	_play_battler_anim(action, false, "hurt")


func _play_battler_anim(action: Dictionary, is_attacker: bool, anim: String) -> void:
	var sprite = _get_sprite_for_action(action, is_attacker)
	if sprite == null or sprite.sprite_frames == null:
		return
	var is_enemy = bool(action.get("attacker_is_enemy", false)) if is_attacker else bool(action.get("target_is_enemy", false))
	var anim_name = "battle_%s_%s" % [anim, _battle_dir(is_enemy)]
	if sprite.sprite_frames.has_animation(anim_name):
		sprite.play(anim_name)
		if anim == "hurt":
			_flash_sprite(sprite)


func _get_sprite_for_action(action: Dictionary, is_attacker: bool) -> AnimatedSprite2D:
	var index_key = "attacker_index" if is_attacker else "target_index"
	var is_enemy_key = "attacker_is_enemy" if is_attacker else "target_is_enemy"
	var index = int(action.get(index_key, -1))
	var is_enemy = bool(action.get(is_enemy_key, false))
	var sprites = _enemy_sprites if is_enemy else _party_sprites
	if index < 0 or index >= sprites.size():
		return null
	return sprites[index]


func _play_idle_all() -> void:
	for sprite in _party_sprites:
		_play_idle(sprite, false)
	for sprite in _enemy_sprites:
		_play_idle(sprite, true)


func _play_idle(sprite: AnimatedSprite2D, is_enemy: bool) -> void:
	if sprite == null or sprite.sprite_frames == null:
		return
	var anim_name = "battle_idle_%s" % [_battle_dir(is_enemy)]
	if sprite.sprite_frames.has_animation(anim_name):
		sprite.play(anim_name)


func _flash_sprite(sprite: AnimatedSprite2D) -> void:
	if sprite == null:
		return
	sprite.modulate = Color(1.4, 1.4, 1.4)
	var tween = get_tree().create_tween()
	tween.tween_property(sprite, "modulate", Color(1, 1, 1), 0.1)


func _battle_dir(is_enemy: bool) -> String:
	return "r" if is_enemy else "l"


func _ensure_data_loaded() -> void:
	if _data_registry == null:
		return
	if _data_registry.enemies.is_empty() and _data_registry.party_members.is_empty():
		_data_registry.load_all()


func _get_party_def(member_id: String):
	if _data_registry == null:
		return null
	return _data_registry.get_party_member(member_id)


func _get_enemy_def(enemy_id: String):
	if _data_registry == null:
		return null
	return _data_registry.get_enemy(enemy_id)


func _get_encounter_def(encounter_id: String):
	if _data_registry == null:
		return null
	return _data_registry.get_encounter(encounter_id)


func _refresh_hud() -> void:
	_set_list(_enemy_list, _battle_state.enemies, false)
	_set_list(_party_list, _battle_state.party, true)


func _set_list(container: Container, actors: Array, show_mp: bool) -> void:
	for child in container.get_children():
		child.queue_free()
	for actor in actors:
		var label = Label.new()
		label.text = _format_actor_line(actor, show_mp)
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		container.add_child(label)


func _format_actor_line(actor, show_mp: bool) -> String:
	var line = "%s  HP %d/%d" % [actor.display_name, actor.hp, actor.max_hp]
	if show_mp:
		line += "  MP %d/%d" % [actor.mp, actor.max_mp]
	if not actor.is_alive():
		line += " (KO)"
	return line


func _update_info(text: String) -> void:
	if _info_label != null:
		_info_label.text = text


func _finish_battle(result: String) -> void:
	if _game_state != null:
		_game_state.input_blocked = false
		_game_state.set_value("battle_result", result)
		_game_state.set_value("battle_turn_complete", true)
	if _encounter_manager != null and _encounter_manager.has_method("finish_encounter"):
		_encounter_manager.finish_encounter(result)
	if return_scene.is_empty():
		get_tree().quit()
		return
	get_tree().change_scene_to_file(return_scene)
