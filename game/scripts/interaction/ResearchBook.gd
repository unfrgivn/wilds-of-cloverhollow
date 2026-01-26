extends Area2D
## ResearchBook - Special book that reveals lore and completes the library research quest

signal interaction_started
signal interaction_ended

@export var book_title: String = "Ancient Town Records"
@export var quest_id: String = "library_research"

## Multi-page lore text
var lore_pages: Array[String] = [
	"The ancient records speak of a time long ago when Cloverhollow was just a small settlement in the forest...",
	"A powerful sorcerer named Malachar once lived in these woods. He was obsessed with controlling the creatures of the forest.",
	"Malachar's experiments went too far. He tried to bend the forest's magic to his will, but the forest fought back.",
	"The founders of Cloverhollow managed to seal Malachar away in the depths of the old mine using a special artifact.",
	"The seal has held for generations... but the records warn: 'Should strange creatures return to Cloverhollow, the seal may be weakening.'",
	"The final page is torn, but you can make out: '...the key to defeating Malachar lies in the four sacred items scattered across...'",
]

var current_page: int = 0
var _reading: bool = false

func _ready() -> void:
	pass

func interact() -> void:
	if _reading:
		_next_page()
		return
	
	interaction_started.emit()
	
	# Check if player has the quest
	if not QuestManager.is_quest_active(quest_id) and not QuestManager.is_quest_completed(quest_id):
		DialogueManager.show_dialogue("'%s' - This old book looks important. Maybe someone in town would be interested in it?" % book_title)
		return
	
	# Already completed
	if QuestManager.is_quest_completed(quest_id):
		DialogueManager.show_dialogue("You've already read the important parts of this ancient record.")
		return
	
	# Start reading
	_reading = true
	current_page = 0
	_show_current_page()

func _show_current_page() -> void:
	if current_page < lore_pages.size():
		var page_text := "[%s - Page %d/%d]\n\n%s" % [book_title, current_page + 1, lore_pages.size(), lore_pages[current_page]]
		DialogueManager.show_dialogue(page_text)
	else:
		_finish_reading()

func _next_page() -> void:
	current_page += 1
	if current_page < lore_pages.size():
		_show_current_page()
	else:
		_finish_reading()

func _finish_reading() -> void:
	_reading = false
	current_page = 0
	
	# Set story flags
	InventoryManager.set_story_flag("learned_villain_lore", true)
	InventoryManager.set_story_flag("found_town_records", true)
	
	print("[ResearchBook] Player finished reading, lore flags set")
	
	# Complete quest objectives
	if QuestManager.is_quest_active(quest_id):
		QuestManager.complete_objective(quest_id, 0)  # Find old records
		QuestManager.complete_objective(quest_id, 1)  # Learn villain history
		print("[ResearchBook] Quest %s completed!" % quest_id)
	
	DialogueManager.show_dialogue("You've learned the dark history of Malachar! This information should help in the investigation.")
	interaction_ended.emit()

func end_interaction() -> void:
	_reading = false
	current_page = 0
	interaction_ended.emit()
