---
name: e2e-tests-gut
description: End-to-end tests in Godot using GUT
compatibility: opencode
---
# Skill: Add Headless E2E-style Tests (GUT, Godot 4.5)

## Objective
Add automated tests that validate the “playable demo” requirements without manual play:
- scene loads
- interaction changes state
- door transitions spawn correctly
- quest completion flag is set

## Steps

1) Install GUT (Godot 4 version)
- Add GUT under: `res://addons/gut/`
- Commit the addon directory (or add an install step for CI).

2) Add a `.gutconfig.json` at repo root
Example:
```json
{
  "dirs": ["res://tests/"],
  "include_subdirs": true,
  "ignore_pause": true,
  "log_level": 2,
  "should_exit": true,
  "should_maximize": false,
  "junit_xml_file": "test-results/gut.xml"
}
```

3) Create helper utilities for deterministic scene tests
- `tests/helpers/test_utils.gd`
  - `advance_frames(tree, n)`
  - `press_action(action_name)`
  - `release_action(action_name)`
  - `await_signal(node, signal_name, timeout_frames)`

4) Add E2E-style tests (scene-driven)
- `tests/e2e/test_demo_smoke.gd`
  - load `scenes/world/Cloverhollow_Town.tscn`
  - assert player exists
  - move a short distance and assert position changes
- `tests/e2e/test_item_pickup.gd`
  - interact with a test container
  - assert inventory count increments and container is marked empty
- `tests/e2e/test_scene_transition.gd`
  - interact with a test door
  - assert scene changed and spawn marker applied
- `tests/e2e/test_quest_hollow_light.gd`
  - acquire Blacklight Lantern
  - reveal a hidden interaction
  - complete quest and assert flag is set

5) Add a CI-friendly wrapper script (recommended)
- `tools/ci/run-tests.sh`:
  - runs headless smoke boot
  - runs GUT CLI and writes JUnit XML to `test-results/`

## CLI

Run all tests:
```bash
godot --headless --path . --script res://addons/gut/gut_cmdln.gd -gconfig=.gutconfig.json
```

Smoke boot:
```bash
godot --headless --path . --quit
```

## Verification
- Tests exit with non-zero on failure.
- JUnit XML exists at `test-results/gut.xml` for CI parsing.
