# AGENTS.md

This repo is designed for autonomous agent work.

## Non-negotiable rules
1. `spec.md` is the single source of truth.
   - If you change behavior, interfaces, file formats, or decisions, update `spec.md` in the same milestone commit.
2. Do not stop to ask questions.
   - Make reasonable assumptions and proceed.
   - If missing input is truly required, add a new future milestone in `docs/working-sessions/plan.md` with clear acceptance criteria and continue.
3. One commit per milestone.
   - Commit message format: `Milestone <N>: <Title>`
   - Push to main immediately after committing (`git push origin main`).
   - Do NOT ask the user for permission to push; push automatically.
   - If push fails, rebase with `git pull --rebase origin main`, resolve conflicts, and push again.
4. No OS-level window control.
   - All verification must run via Scenario Runner and deterministic artifacts (captures + traces).
5. Small diffs only.
   - Avoid refactors unless required to complete the current milestone.

## Definition of Done (every milestone)
A milestone is complete only if all are true:

A) Implementation
- Code + scenes live under `res://game/...` only (unless spec explicitly says otherwise).
- No manual editor-only steps required to reproduce; if unavoidable, document precisely in `docs/`.

B) Spec hygiene
- `spec.md` updated if anything changed materially.

C) Automation
- Add or update at least one Scenario Runner scenario proving the milestone.
- Ensure deterministic artifacts written under `captures/`.
- If UI/visual changes occurred: add/update a rendered capture scenario.

D) Tests
- Add/update tests where appropriate.

E) Docs
- Update `docs/` if new flags, commands, workflows, or schemas were introduced.

## Mandatory commands to run (every milestone)
Agents must run and report results for:

- `./tools/ci/run-smoke.sh`
- `./tools/ci/run-tests.sh`
- `./tools/ci/run-spec-check.sh`
- `./tools/ci/run-scenario.sh <scenario_id>`
- `./tools/ci/run-scenario-rendered.sh <scenario_id>` (if present; if missing and milestone affects visuals/UI, implement it)

## Milestone progression
Use `/next-milestone` to select work from `docs/working-sessions/plan.md`.

Milestone completion status convention:
- Completed milestones include `**Status:** ✅ Completed (YYYY-MM-DD)` in the milestone header line.
- Incomplete milestones have no status field.
