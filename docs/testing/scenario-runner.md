# Scenario Runner

## Why it exists
Agents cannot rely on OS-level window control to playtest the game. The Scenario Runner provides deterministic, scripted playthroughs that can run from CLI and emit artifacts (trace + captures).

## CLI contract (baseline)
The game should accept args after `--`, for example:

- `--scenario scenario_id`
- `--scenario_file tests/scenarios/scenario_id.json`
- `--seed 12345`
- `--capture_dir captures/<run_id>`
- `--quit_after_frames 1800`

## Scenario actions (baseline)
Recommended minimal action set:
- `load_scene`: load an area/battle scene
- `wait_frames`: advance deterministic frames
- `move`: inject movement vector for N frames
- `press`: simulate a button press (interact, confirm, cancel)
- `capture`: save a PNG checkpoint with a label
- `assert`: basic assertions (scene loaded, variable equals)

## Artifacts
- `trace.json`: chronological events + asserts
- `frames/*.png`: capture checkpoints
