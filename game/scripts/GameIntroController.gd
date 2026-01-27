extends Node
## GameIntroController - Manages the game intro sequence
## Title Screen → Intro Narration → Pet Selection → Hero Bedroom

enum IntroState { TITLE, NARRATION, PET_SELECTION, GAME }

const TITLE_SCREEN_SCENE := preload("res://game/scenes/ui/TitleScreen.tscn")
const INTRO_NARRATION_SCENE := preload("res://game/scenes/ui/IntroNarration.tscn")
const PET_SELECTION_SCENE := preload("res://game/scenes/ui/PetSelectionUI.tscn")
const HERO_BEDROOM_PATH := "res://game/scenes/areas/Area_HeroHouseUpper.tscn"

var current_state: IntroState = IntroState.TITLE
var title_screen: CanvasLayer
var intro_narration: CanvasLayer
var pet_selection: CanvasLayer


func _ready() -> void:
    _show_title_screen()


func _show_title_screen() -> void:
    current_state = IntroState.TITLE
    title_screen = TITLE_SCREEN_SCENE.instantiate()
    title_screen.start_pressed.connect(_on_title_start_pressed)
    add_child(title_screen)


func _on_title_start_pressed() -> void:
    title_screen.queue_free()
    _show_intro_narration()


func _show_intro_narration() -> void:
    current_state = IntroState.NARRATION
    intro_narration = INTRO_NARRATION_SCENE.instantiate()
    intro_narration.narration_finished.connect(_on_narration_finished)
    add_child(intro_narration)


func _on_narration_finished() -> void:
    intro_narration.queue_free()
    _show_pet_selection()


func _show_pet_selection() -> void:
    current_state = IntroState.PET_SELECTION
    pet_selection = PET_SELECTION_SCENE.instantiate()
    pet_selection.pet_selected.connect(_on_pet_selected)
    add_child(pet_selection)
    pet_selection.show_selection()


func _on_pet_selected(_pet_id: String) -> void:
    pet_selection.queue_free()
    _start_game()


func _start_game() -> void:
    current_state = IntroState.GAME
    # Load hero bedroom using SceneRouter
    SceneRouter.change_area(HERO_BEDROOM_PATH, "bed")
