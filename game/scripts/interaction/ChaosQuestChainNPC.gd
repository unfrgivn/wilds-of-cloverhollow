extends Area2D
## ChaosQuestChainNPC - NPC that progresses the chaos quest chain
## Handles multiple quests in sequence based on story flags

@export var npc_name: String = "NPC"
@export var npc_role: String = "quest_giver"  # quest_giver, evidence_receiver, forest_unlocker

# Quest giver dialogue (Mayor)
@export var quest_intro_dialogue: String = "Strange things are happening in town..."
@export var quest_active_dialogue: String = "Have you talked to everyone yet?"
@export var quest_complete_dialogue: String = "Thank you for investigating!"

# Evidence receiver dialogue (Elder)
@export var need_evidence_dialogue: String = "We need proof of what's happening."
@export var evidence_received_dialogue: String = "This evidence confirms my fears. The forest holds answers..."

# Forest unlocker dialogue (Elder after evidence)
@export var unlock_forest_dialogue: String = "Take this lantern. The path to the forest is now open to you."

@export var quest_to_give: String = "chaos_investigation"
@export var quest_to_complete: String = ""
@export var required_flag: String = ""
@export var grants_flag: String = ""

func interact() -> void:
	match npc_role:
		"quest_giver":
			_handle_quest_giver()
		"evidence_receiver":
			_handle_evidence_receiver()
		"forest_unlocker":
			_handle_forest_unlocker()
		_:
			DialogueManager.show_dialogue("Hello there!")

func _handle_quest_giver() -> void:
	# Check if quest is already done
	if quest_to_give != "" and QuestManager.is_quest_completed(quest_to_give):
		DialogueManager.show_dialogue(quest_complete_dialogue)
		return
	
	# Check if quest is active
	if quest_to_give != "" and QuestManager.is_quest_active(quest_to_give):
		DialogueManager.show_dialogue(quest_active_dialogue)
		return
	
	# Give the quest
	DialogueManager.show_dialogue(quest_intro_dialogue)
	await DialogueManager.dialogue_finished
	
	if quest_to_give != "":
		QuestManager.start_quest(quest_to_give)

func _handle_evidence_receiver() -> void:
	# Check if we have all evidence
	var has_shard = InventoryManager.has_story_flag("evidence_glowing_shard_collected")
	var has_cloak = InventoryManager.has_story_flag("evidence_torn_cloak_collected")
	
	if has_shard and has_cloak:
		DialogueManager.show_dialogue(evidence_received_dialogue)
		await DialogueManager.dialogue_finished
		
		# Set evidence gathered flag and complete quest
		InventoryManager.set_story_flag("chaos_evidence_gathered")
		if QuestManager.is_quest_active("chaos_gather_evidence"):
			QuestManager.complete_objective("chaos_gather_evidence", 2)
	else:
		DialogueManager.show_dialogue(need_evidence_dialogue)

func _handle_forest_unlocker() -> void:
	# Check if forest is already unlocked
	if InventoryManager.has_story_flag("forest_unlocked"):
		DialogueManager.show_dialogue("The forest path is open. Be careful in there!")
		return
	
	# Check if evidence has been gathered
	if not InventoryManager.has_story_flag("chaos_evidence_gathered"):
		DialogueManager.show_dialogue("We need more evidence before we can proceed.")
		return
	
	# Unlock the forest
	DialogueManager.show_dialogue(unlock_forest_dialogue)
	await DialogueManager.dialogue_finished
	
	# Grant lantern and unlock forest
	InventoryManager.acquire_tool("lantern")
	InventoryManager.set_story_flag("forest_unlocked")
	
	# Complete the unlock quest
	if QuestManager.is_quest_active("chaos_unlock_forest"):
		QuestManager.complete_objective("chaos_unlock_forest", 0)
		QuestManager.complete_objective("chaos_unlock_forest", 1)
