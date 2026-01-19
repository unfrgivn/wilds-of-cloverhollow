# Scenario Runner

## Goal
Allow agents to playtest without OS-level control.

## Inputs
Run with CLI args passed after `--`:
- `--scenario <id>`
- `--capture_dir <dir>`
- `--seed <int>`
- `--quit_after_frames <int>`

## Scenario files
Scenario definitions live in:
- `tests/scenarios/<id>.json`

Initial JSON schema (v1):
```json
{
  "id": "movement_smoke",
  "start_scene": "res://game/scenes/tests/TestRoom_Movement.tscn",
  "seed": 12345,
  "actions": [
    {"type": "wait_frames", "frames": 30},
    {"type": "move_to", "x": 4.0, "z": 2.0, "tolerance": 0.2, "timeout_frames": 600},
    {"type": "capture", "label": "arrived"}
  ]
}
```

## Outputs
- `trace.json`
- optional movie output in deterministic mode

Recommended capture folder structure:
- `captures/<scenario_id>/<timestamp>/trace.json`
- `captures/<scenario_id>/<timestamp>/frames/*.png` (optional)
- `captures/<scenario_id>/<timestamp>/movie/*.png` (PNG sequence, optional)

## Recommended scenario actions
- wait_frames
- move_to (navagent)
- interact (by node name/group)
- trigger_encounter
- capture_checkpoint

## Deterministic video capture (preferred)
Prefer Godot Movie Maker mode for regression because it does not require OS-level screen recording.

Example pattern (actual flags may vary by implementation):
```bash
godot --path . --write-movie "captures/<id>/movie/frame.png" --fixed-fps 30 -- --scenario <id> --quit_after_frames 1800
```
