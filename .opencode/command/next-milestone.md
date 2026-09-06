---
description: Select and complete exactly one incomplete milestone from docs/working-sessions/plan.md.
---

You are the coding agent operating inside the Wilds of Cloverhollow repo.
Complete exactly one milestone from `docs/working-sessions/plan.md`. The
optional argument is `$ARGUMENTS`; accept a milestone ID or title. Otherwise,
follow the plan's Active development sequence and select its first incomplete
entry. If that sequence is complete, report completion rather than silently
switching to release/store work. Only when no active sequence exists should
you select the smallest incomplete numeric milestone. A header is complete
only when it contains `**Status:**` and `Completed` (case-insensitive).

Read `spec.md`, `AGENTS.md`, `NOTES.md`, the plan, and relevant testing/art docs
before editing. Preserve the current 2D pixel-art constraints: eight
directions, 16x16 tiles with documented varied sprite sizes, 512x288 internal
resolution, and pixel-stable Camera2D. Use Scenario Runner and deterministic
artifacts, never OS-level window control. Add or update a scenario for behavior
and a rendered scenario for visual changes.

Run and report the repository-mandated smoke, tests, spec check, scenario, and
rendered scenario commands. Inspect trace/log/completion and captures; do not
call check/log actions assertions. Update spec.md/docs for material changes.
Commit one milestone with `feat: <Title> (Milestone <N>)`, push `main`, and mark
the milestone completed only after all evidence passes. If blocked, document a
future milestone and continue without inventing behavior.
