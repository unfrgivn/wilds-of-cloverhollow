---
name: scene-transitions
description: Implement scene routing, fades, and spawn points
compatibility: opencode
---
# Skill: Scene Transitions + Spawn Points

## Objective
Implement building entry/exit transitions between scenes with deterministic spawn placement.

## Steps

1) Define spawn points in each location scene
- Add a `SpawnPoints` Node2D.
- Add `Marker2D` children named by spawn id (e.g., `FrontDoor`, `BedroomDoor`).

2) Implement `SceneRouter` autoload
Responsibilities:
- `goto(scene_path: String, spawn_id: String)`
- fade out → change scene → position player at spawn → fade in
- preserve `GameState` across scenes
- optionally keep a persistent Player instance between scenes

3) Implement a `Door` node/scene
- `Area2D` with exported fields:
  - target scene path
  - target spawn id
- When interacted with (or entered), calls `SceneRouter.goto(...)`.

4) Add transitions to the demo scenes
- Town ↔ House
- Town ↔ School
- Town ↔ Arcade
- Bedroom ↔ Hall/Living (if separate scenes)

## Verification checklist
- Entering a door reliably changes scenes.
- Player appears at the correct spawn marker every time.
- Inventory/flags persist across transitions.
