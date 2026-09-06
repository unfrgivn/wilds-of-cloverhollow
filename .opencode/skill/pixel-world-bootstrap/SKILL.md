---
name: pixel-world-bootstrap
description: Establish or repair a Cloverhollow Godot 4.5.1 2D pixel world, including 512x288 viewport scaling, pixel-stable Camera2D, CharacterBody2D movement, collisions, and scene boundaries.
compatibility: Godot 4.5.1, repository Scenario Runner, and optional read-only satellite snapshot inspection
---

# Pixel world bootstrap

Read `spec.md`, `docs/art/style-lock.md`, and the current scene/scripts first.
Do not invent a scene, input action, or node path. The project uses
16x16 tiles but sprites can have documented varied sizes (for example 16x24).
Keep nearest-neighbor scaling and the 512x288 internal base resolution.

## Workflow

1. Inspect the existing `game/` scene, player, collision, camera, spawn, and
   area-transition implementations before editing.
2. Make the smallest scene/script change that preserves the spec and existing
   input actions. Keep camera limits and collision shapes explicit.
3. Exercise movement with a Scenario Runner scenario using real `move` or
   `press` actions, not a fabricated state change.
4. Verify the resulting `trace.json`, log, completion status, and captures.
   Read/inspect captured images for camera seams, clipping, boundary escape,
   and incorrect scaling.

Fail closed if a required scene or input action is absent. No OS-level window
automation, blanket quantization, or visual claim without a captured artifact.
