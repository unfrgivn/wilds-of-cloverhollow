# Godot agent tooling audit

This records the initial audit and its first repair attempt. Subsequent verified
startup work is recorded in `docs/working-sessions/m224-readiness.md`; the
adopted snapshot inspector is described in `godot-agent-environment.md`.

## Scope

This audit prepares local agents to resume development. It does not certify that
every area, quest, or level is playable. A connected MCP server, a successful
process exit, and a completed milestone header are not gameplay evidence.

## Verified environment

- `opencode2`: `v0.0.0-beta-19151`.
- `opencode2 mcp list`: Godot, Context7, Exa, and Chrome DevTools connected.
- Godot MCP `get_godot_version`: `4.5.1.stable.official.f62fdbde1`.
- Godot MCP `get_project_info`: 77 scenes, 139 scripts, 502 assets.
- The local `godot-lsp-bridge` executable exists. Its package is
  `opencode-godot-lsp`; executable presence alone does not prove diagnostics work.
  OpenCode V2 documentation currently says its `lsp` config does not start
  servers, so the configured bridge is not a verified diagnostics integration.
- Bun, Node, ImageMagick, Gemini CLI, and Python with Pillow are available.
- Aseprite is not on PATH. Image-generation API keys were absent from the audit
  shell; authentication through other credential stores was not checked.

No credentials were printed, dependencies installed, or global configuration
changed during the audit. Game verification uses Scenario Runner artifacts,
not OS-level window control.

## Findings before repairs

| Area | Evidence | Consequence |
| --- | --- | --- |
| Local skill discovery | Six `SKILL.md` files had no name/description frontmatter | Playbooks were not reliably discoverable |
| Local agents | Four agent files had no frontmatter | Specialist configuration was incomplete |
| Test gate | `run-tests.sh` printed a placeholder and exited zero | Green did not mean tests ran |
| Smoke gate | Startup output was discarded and errors ignored | Broken startup could report success |
| Scenario gate | Wrappers trusted engine exit status | Trace failures could be missed |
| Scenario coverage | 173 JSON scenarios existed | File count did not establish assertions or complete playthroughs |
| Visual regression | No tracked baselines; neither `baselines/visual` nor `captures/golden` existed locally | No visual regression certification was possible |
| Palette tooling | Quantizer reads `.colors[]`; current palettes contain nested categories | Existing normalization commands are not a safe production gate |
| Sprite validation | Bench validation rejected `#000000`; Pillow found 154 transparent black pixels and zero visible black pixels | Validator confused transparency with a palette violation |
| Asset task runner | Quantization referenced missing `global.palette.json`, not `global_ui_skin.palette.json` | Task could skip the actual palette and still appear successful |
| Image generation | Legacy custom tool used `gemini --yolo` and claimed an unverified output directory | Unattended use needs a narrower, verified execution contract |
| Version parity | CI specified Godot 4.4, local MCP reported 4.5.1 | Cross-machine rendered results are not directly comparable |
| Milestone selection | Canonical plan's earliest incomplete entry was M130, iOS/TestFlight | Blind `/next-milestone` would not resume artwork or level validation |

The initial art check is retained in
`captures/tooling-audit/bench-validation.log`. Do not recolor the bench to work
around a validator defect.

## Tooling boundary

The existing Godot MCP is a working baseline, not yet a maintenance endorsement.
Compare its upstream and current alternatives before deciding to retain,
upgrade, or replace it. Evaluate new servers in an isolated project before
giving them write access to this game.

The completed source comparison is in [Godot MCP research](godot-mcp-research.md).
The old snapshot predates an upstream security-related fix. It is quarantined
in project configuration rather than upgraded silently. The recommended first
evaluation target is canonical `satelliteoflove/godot-mcp` 4.1.11, not its
older `freema` fork. No replacement runtime has been certified on this game.

Keep the checked-in Scenario Runner as the acceptance authority for runtime
input, assertions, captures, and reproduction. A new MCP may improve inspection
or iteration, but it must preserve this reproducible testing contract.

Use image reading or vision analysis on rendered artifacts for composition,
readability, occlusion, collision cues, and UI clipping. A visually pleasing
capture does not prove collision or progression behavior. A trace that only
logs state does not prove an assertion passed.

Treat generated art as source material. Keep recipes, palette choices, source
references, dimensions, direction/frame ordering, and output paths explicit.
Do not run blanket in-place quantization, update goldens automatically, or
invoke paid generation as a prerequisite for resuming local work.

## Resume prerequisites

1. Run the repaired smoke, test, spec, headless-scenario, and rendered-scenario
   gates. Read their logs and trace outcomes, not just command exit status.
2. Inspect at least one rendered capture. Keep failures separate from accepted
   visual baselines.
3. Repair palette validation/normalization before relying on an art quality gate.
4. Establish reviewed visual baselines with matching engine and renderer settings.
5. Prove a small route using actual movement, blocked boundaries, door entry,
   destination spawn, return travel, and a progression gate. Expand coverage
   area by area rather than declaring the full campaign tested.
6. Select an explicit development milestone. The existing uncommitted graphics
   plan is reference material, not a substitute for the canonical plan's status.

Existing uncommitted changes to `SceneRouter.gd`, `GameIntroController.gd`,
`TitleScreen.gd`, `project.godot`, and the graphics milestone document belong to
the pre-audit workspace. They must be preserved and reviewed independently.

## Additional content check

`just lint-content` passed with zero errors and three warnings. Enemies reference
undefined skills `dust_kick`, `quick_nibble`, and `dive_peck`. See
`captures/tooling-audit/content-lint.log`. These warnings were not repaired as
part of the agent configuration work.

## Independent verification after repairs

| Check | Result |
| --- | --- |
| `opencode2 mcp list` | Godot disabled; Context7, Exa, Chrome DevTools connected |
| Local skill discovery | All eight skills appeared in the live catalog; `godot-level-playtest` loaded successfully |
| Validator unit tests | Seven passed after the failed-assertion regression was added |
| Real missing-scenario regression | Passed, checked the exact error in the generated trace |
| `./tools/ci/run-smoke.sh` via `just smoke` | Failed on existing startup errors |
| `./tools/ci/run-tests.sh` via `just tests` | Unit/missing-scenario checks passed, real game gate failed |
| `./tools/ci/run-spec-check.sh` via `just spec-check` | Passed |
| `./tools/ci/run-scenario.sh readiness_harness_smoke` | Failed on existing game errors |
| `./tools/ci/run-scenario-rendered.sh readiness_harness_smoke` | Produced a frame, failed on existing game errors |
| Changed tooling/config whitespace check | Passed; the broader working tree still has pre-existing SceneRouter whitespace |

The main check results are in `captures/tooling-audit/final/results.json`, with
per-command logs beside it. The final validator-only rerun is in
`captures/tooling-audit/final/unit-final.log`.

Inspected rendered evidence:
`captures/rendered/readiness_harness_smoke/run.xOwa9U/0046_action_execution.png`.
It contains a rendered town scene at 512x288, rather than an empty viewport.
The frame does not establish movement, collision correctness, or progression.
It is diagnostic evidence, not an approved golden baseline.

The final game logs report:
- Failure to load `res://game/data/localization/translations.csv`.
- Missing `ControlsOverlay` child nodes (`Panel`, `Dimmer`, and panel children).
- Scene removal while the parent is adding/removing children, from
  `SceneRouter.gd:69` through `GameIntroController.gd:26`.

An earlier rendered transition attempt additionally reported collision-object
removal during a physics callback. The readiness scenario was renamed and
corrected during review because its original movement/scene-load sequence did
not actually prove boundaries or door transitions.

Further tooling limitations:
- The vision helper failed with `Model unavailable: github-copilot/gemini-3-flash-preview`.
  Direct image reading worked as the fallback. No global model settings changed.
- Standalone skill API results disagreed with live catalog discovery. The live
  catalog and an actual skill load were verified; API parity was not.
- Runtime orchestration diagnostics passed, but that control surface did not
  show the delegated tasks launched by the current tool adapter. Its task count
  is not evidence that no child sessions were running.
- The new test/scenario scripts need Bun provisioned in CI. The existing
  workflows also remain on Godot 4.4, unlike this local 4.5.1 verification.
- RNG, process/physics timing, and test save-state isolation still need work.

The initial audit stopped before completion while game gates were red. M224
subsequently passed the required gates and rendered repeatability checks and
was committed as `afe8457`. Unrelated changes were not reverted. Treat the
earlier failure table as historical evidence, not the current readiness result.
