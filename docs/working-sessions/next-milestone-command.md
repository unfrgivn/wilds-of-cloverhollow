# /next-milestone command

## Purpose
Run `/next-milestone` to select and complete the next incomplete milestone from `docs/working-sessions/plan.md`.

## Milestone selection rule
- Completed milestones include `**Status:** ✅ Completed (YYYY-MM-DD)` in the milestone header line.
- Incomplete milestones have no status field.
- The command should pick the smallest milestone number that is incomplete.

## Usage
- `/next-milestone`
- `/next-milestone M3`
- `/next-milestone "Milestone 3 — Area transitions + spawn system"`

## Definition of Done
The command enforces the rules in `AGENTS.md`:
- one milestone per commit
- mandatory scripts must pass
- scenario evidence required
