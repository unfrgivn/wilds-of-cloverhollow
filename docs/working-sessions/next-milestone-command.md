# Command: /next-milestone

## Purpose
Use `/next-milestone` to start a milestone implementation session with all required context, automation constraints, and verification steps baked into the prompt. It is designed to keep `spec.md` authoritative and enforce deterministic Scenario Runner validation without OS-level window control.

## Usage
Run the command from the opencode prompt:

```bash
/next-milestone
```

Target a specific milestone:

```bash
/next-milestone "Milestone 2: Interactions + dialogue"
/next-milestone M2
```

## Arguments
- `milestone_id_or_name` (optional): A milestone number, shorthand (e.g., `M2`), or full milestone header text.

If omitted, the command selects the next incomplete milestone from `docs/working-sessions/plan.md` using the status parsing rules below.

## Required Reads
The command requires the agent to read these files before writing code:
- `./spec.md`
- `./AGENTS.md`
- `./NOTES.md`
- `./docs/working-sessions/plan.md`
- `./docs/testing/scenario-runner.md`
- `./docs/ui/battle-ui.md`
- `./docs/art/style-lock.md`
- `./docs/art/palettes.md`

If any path does not exist, the agent must locate the canonical alternative and report the resolved paths in its output.

## Workflow Overview
1. Read the required files in full.
2. Select the milestone (explicit argument or status-driven selection).
3. Quote the selected milestone header, objective, and acceptance criteria.
4. Plan the smallest set of commits (prefer 1–3).
5. Implement the milestone end-to-end under `res://game/...`.
6. Add or update at least one Scenario Runner scenario proving the milestone.
7. Run verification commands and report results.
8. Update `spec.md` and docs for any new behavior or workflows.

## Milestone Selection Rules
If no argument is supplied, the agent must parse `docs/working-sessions/plan.md` as follows:
- Parse milestone headers matching `^## Milestone <number>`.
- For each milestone header line, if the same line contains `**Status:**` and the word `Completed` (case-insensitive), treat it as COMPLETE.
- Otherwise treat it as INCOMPLETE.
- Choose the INCOMPLETE milestone with the smallest milestone number.
- If all milestones are COMPLETE, stop and report that no next milestone exists.

The agent must quote the milestone header line verbatim, quote the Objective section if present (otherwise summarize it faithfully), and quote or list the acceptance criteria verbatim (otherwise derive them from tasks and state they were derived).

## Definition of Done
A milestone is complete only when all of the following are true:
- **Implementation**: Code and scenes live under `res://game/...` unless `spec.md` explicitly says otherwise. No manual editor-only steps are required to reproduce results, otherwise they must be documented precisely in `docs/`.
- **Spec hygiene**: `spec.md` updated in the same change if behavior, interfaces, or decisions changed.
- **Automation**: At least one Scenario Runner scenario proves the milestone and writes deterministic artifacts to `captures/`. If UI or visuals changed, add/update a rendered capture scenario.
- **Tests**: Add or update tests where appropriate.
- **Documentation**: Update `docs/` for new flags, commands, workflows, or schemas.

## Verification Commands
Run and report the following:

```bash
./tools/ci/run-smoke.sh
./tools/ci/run-tests.sh
./tools/ci/run-spec-check.sh
./tools/ci/run-scenario.sh <scenario_id>
```

If `./tools/ci/run-scenario-rendered.sh` exists and the milestone affects visuals or UI, also run:

```bash
./tools/ci/run-scenario-rendered.sh <scenario_id>
```

If the rendered script does not exist and visual/UI changes are involved, the milestone must implement it.

## Troubleshooting
- **All milestones complete**: Confirm whether a new milestone should be added to `docs/working-sessions/plan.md` before proceeding.
- **Milestone not found**: Ensure the header matches `## Milestone <number>` and is not already marked completed.
- **Missing required file**: Locate the canonical alternative and report the resolved path in the output.
- **Scenario failures**: Inspect deterministic artifacts under `captures/` and ensure the scenario does not require window focus.

## Dry-run Validation
For wiring checks, run `/next-milestone` and stop after milestone selection and prompt generation. Do not implement any feature work during this dry run. This validates selection logic, required reads, and verification steps without changing code.
