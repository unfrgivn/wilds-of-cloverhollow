extends GutTest

var main_scene: MainScene
var player: Player

func before_each():
    main_scene = load("res://scenes/bootstrap/Main.tscn").instantiate()
    player = main_scene.get_node("Player")
    add_child(main_scene)

func after_each():
    main_scene.queue_free()

func test_on_animation_finished_starts_player_movement():
    assert_true(main_scene.get_node("AnimationPlayer").is_connected("animation_finished", Callable(main_scene, "_on_level_loaded")), "AnimationPlayer's animation_finished signal should be connected to _on_level_loaded")
    assert_false(player.can_move, "Player should not be able to move before animation finishes")
    main_scene.get_node("AnimationPlayer").emit_signal("animation_finished", "fade_in")
    assert_true(player.can_move, "Player should be able to move after animation finishes")
