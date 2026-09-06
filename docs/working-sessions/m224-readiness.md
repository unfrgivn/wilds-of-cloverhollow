# Milestone 224: reliable startup and scenario execution

Completed 2026-09-06. This milestone establishes the testing foundation, not a
fully verified game or town-to-forest route.

## Changes

- Fixed localization resource references and premature `ControlsOverlay` child
  lookups without disabling those systems.
- Deferred scene replacement so startup and physics callbacks can request a
  transition safely.
- Replaced the unconditional development intro bypass with `--skip-intro`.
  Explicit area scenarios own their starting scene; normal startup keeps the
  splash/title flow.
- Added assertion-backed scene, spawn, intro, and save-state checks.
- Made async scenario actions single-flight and synchronized input/captures.
- Replaced false-green smoke/tests with log, trace, completion, and artifact
  checks. Scenario processes have a watchdog and fresh output directories.
- Isolated Godot user data per run and checked personal-data manifests before
  and after execution.
- Aligned CI with Godot 4.5.1 and Bun 1.3.10. CI import failures are not ignored.

The pre-existing intro/router, title-focus, and WASD work was retained and
integrated into this repair. Its initial diff is preserved under
`captures/m224/baseline/`. The separate graphics milestone draft was not included.

## Independently verified

| Command | Result |
| --- | --- |
| `just smoke` | Pass |
| `just tests` | Pass, including seven validator tests and real engine scenarios |
| `just spec-check` | Pass |
| `just scenario readiness_harness_smoke` | Pass |
| `just scenario-rendered readiness_harness_smoke` | Pass |
| `bash tests/test_repeatability.sh --rendered` | Pass |

The `just` recipes invoke the repository's mandatory `tools/ci` scripts.
Logs and exit codes are in `captures/m224/parent-acceptance/results.json`.

The headless trace verifies TownCenter and its `from_hero_house` spawn at
`(80, 160)`. Recorded movement checkpoints are `(70, 160)`, `(70, 150)`,
`(90, 150)`, and `(90, 170)`. Fresh repeat runs match those checkpoints and the
rendered PNG bytes. The save roundtrip records exactly one successful load,
successful save/delete operations, and matching existence assertions.

The rendered frame at
`captures/m224/parent-acceptance/rendered/0048_action_execution.png` was inspected
as a functioning native 512x288 game capture. It is readiness evidence, not a
finished-art baseline.

Personal user-data manifests matched. The trace's actual user directory is
inside the run's `runtime/home/Library/Application Support/Godot/app_userdata/`
tree on this Mac.

## Remaining scope

- Real door/gate round trips and map boundaries belong to M226.
- Art tool/baseline acceptance belongs to M225.
- MCP snapshot inspection belongs to M227 and is not required to run tests.
- Wall-clock systems and unexamined RNG sources are not certified deterministic.
- Renderer/platform changes require new comparison evidence, not an automatic
  golden update.
