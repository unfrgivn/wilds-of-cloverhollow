---
name: dialogue-box
description: Implement EarthBound-style dialogue UI and input flow
compatibility: opencode
---
# Skill: Dialogue Box UI (Typewriter + Advance)

## Objective
Implement a reusable dialogue box for NPC and object interactions.

## Steps
1. Create `DialogueBox.tscn` (Control):
   - panel/background
   - label for text
   - optional “continue” icon
2. Implement `DialogueBox.gd`:
   - `show_text(text: String)`
   - typewriter reveal with configurable speed
   - press Interact to:
     - instantly reveal if mid-type
     - otherwise advance/close
3. Implement a simple `DialogueManager` (autoload or scene-level):
   - queues lines
   - blocks player input while visible

## Verification
- NPC interaction displays multi-line dialogue.
- Dialogue can be advanced quickly.
