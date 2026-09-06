---
name: godot-level-playtest
description: Playtest Cloverhollow 2D levels end to end with Scenario Runner real movement and evidence. Use for boundary, collision, camera, door/area transition, spawn-marker, and quest-gate round trips.
compatibility: Godot 4.5.1 and Scenario Runner
---

# Godot level playtest

Use this as a behavioral playtest, not a static code review. Read `spec.md`,
the target scene/scripts, and `docs/testing/scenario-runner.md` first. Inspect
the existing scenario catalog and choose real scene paths, input actions, door
targets, spawn IDs, and quest IDs. Never invent an action or node path.

## Round-trip workflow

1. Establish a deterministic start with the real scenario scene, seed, and a
   short settle wait. Capture the initial state when visual evidence matters.
2. Use real `move` and `press` actions to approach each boundary and collision
   from both sides. Verify the player cannot escape, clip through, or become
   stuck. A `check_*` action only logs state; it is not an assertion.
3. Exercise camera limits while moving at least one screen-width in each
   available direction. Inspect captures for seams, fractional scaling,
   clipping, and the 512x288 pixel-art presentation.
4. Enter every relevant door/area transition, then verify the destination
   scene and intended `SpawnMarker` round trip. Return through the door and
   verify the original area and reciprocal spawn, using actual input.
5. For a quest gate, test both closed and opened states: approach before the
   prerequisite, perform the real prerequisite flow, revisit the gate, enter,
   then return. Preserve a fail-closed result if the prerequisite cannot be
   proven by the trace or explicit game output.
6. Check collision and spawn behavior after reload/transition, not only on the
   first frame. Capture before/after states for visual or camera changes.

## Evidence gate

Run `./tools/ci/run-scenario.sh <scenario_id>` for behavior and the rendered
wrapper when captures are required. The read-only `satellite` MCP may inspect a
separately launched snapshot, but it cannot launch, stop, or drive the game.
Examine command exit status, `run.log`,
`trace.json`, `passed`, errors, error/noop events, expected input/transition
events, and completion. Read every PNG with the image reader or vision tool.
Do not call a log line, `check_*` action, or successful process exit an
assertion by itself. Fail closed for missing traces, missing captures,
ambiguous spawn placement, unexercised return paths, or unverified quest gates.
No OS-level window automation and no blanket asset quantization.
