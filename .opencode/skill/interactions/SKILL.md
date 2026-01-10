---
name: interactions
description: Add interactable protocol, detection, and item interactions
compatibility: opencode
---
# Skill: Interactables (NPCs, Signs, Containers)

## Objective
Provide a consistent EarthBound-like “Talk/Check” interaction system for:
- NPC conversations
- signs/plaques/bulletin boards
- containers that give items once
- special quest interactions (hidden objects revealed by the lantern)

## Recommended pattern
- Player owns an `InteractionDetector` (`Area2D`) that tracks nearby interactables.
- Interactables join group: `interactable`
- Interactables implement a consistent API (interface-by-convention):
  - `get_prompt() -> String`
  - `interact(actor: Node) -> void`

`interact()` should use:
- `GameState` (autoload) to mutate flags/inventory
- `UIRoot` (or DialogueManager) to display dialogue

## Steps

1) Create a reusable base script (recommended)
- `scripts/interactions/interactable.gd` (class_name Interactable)
  - default prompt
  - helper for opening dialogue

2) Create interactable scenes
- `scenes/npcs/NPC.tscn`
- `scenes/props/Sign.tscn`
- `scenes/props/Container.tscn`

3) Player interaction selection
- On `interact` action press:
  - select the nearest interactable in range (or the one “in front” of facing)
  - call `interact(self)`

## Verification checklist
- NPC: shows multi-line dialogue and closes cleanly.
- Sign: shows text and closes cleanly.
- Container: adds item to inventory and becomes “empty” after first open.
