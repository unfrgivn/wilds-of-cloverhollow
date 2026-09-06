---
description: Review Godot project readiness using existing CI, Scenario Runner artifacts, and visual evidence.
---

Review `$ARGUMENTS` as a scenario ID, readiness area, or empty request for the
default readiness pass. Read `spec.md`, relevant docs, and existing scripts.
Run only existing repository tasks, preferring:

- `./tools/ci/run-smoke.sh`
- `./tools/ci/run-tests.sh`
- `./tools/ci/run-spec-check.sh`
- `./tools/ci/run-scenario.sh <scenario_id>`
- `./tools/ci/run-scenario-rendered.sh <scenario_id>` when visual evidence is needed

Read each produced `run.log` and `trace.json`; require exit 0, valid JSON,
`passed: true`, no errors/noop events, expected real input and transitions, and
expected PNG captures. Use image reading/vision on captures. Report blockers
honestly, including placeholder art validators, palette-format mismatch,
quantizer overwrite/error-swallowing risks, and optional unverified image
generation. Do not add tests, edit game/spec/docs, install tools, use API keys,
or use OS-level window automation in this command. `check_*` actions are
observations, not assertions.
