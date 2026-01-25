# /next-milestone

Use this command to complete the next incomplete milestone from `docs/working-sessions/plan.md`.

## Usage
- `/next-milestone`
- `/next-milestone M3`
- `/next-milestone "Milestone 3 — Area transitions + spawn system"`

## Prompt
You are the coding agent operating inside the Wilds of Cloverhollow repo.

Primary objective
Keep progressing through the next milestone in `docs/working-sessions/plan.md` using the milestone selection rules below. Complete exactly one milestone per run.

Hard constraints (non-negotiable)
- Treat ./spec.md as the single source of truth. If behavior/interfaces/decisions change, update spec.md in the same milestone commit.
- Follow ./AGENTS.md workflows, including small diffs, tests, and automation.
- Do NOT stop to ask questions. Make reasonable assumptions. If additional input is required, add it as a future milestone and move forward.
- Do NOT depend on OS-level window control. Validation must be via Scenario Runner + deterministic artifacts (captures + traces). Use rendered scenario runs for UI/visual changes.
- Platform: iOS native, landscape only; macOS dev.
- Game: 2D pixel art; 16x16 tiles; internal base resolution 512x288; pixel-stable Camera2D.
- Movement: free analog; 4-direction facing baseline (8-direction later as an upgrade milestone).
- Encounters: visible overworld enemies.
- Battles: turn-based; pre-rendered pixel battle backgrounds.
- Battle UI: enemy + party HUD at top. No cassette theming. No large themed device bar. Boxes are acceptable for v0.

Step 0: Read these files fully before writing code:
- ./spec.md
- ./AGENTS.md
- ./NOTES.md
- ./docs/working-sessions/plan.md
- ./docs/testing/scenario-runner.md
- ./docs/testing/visual-regression.md
- ./docs/ui/battle-ui.md
- ./docs/art/style-lock.md
- ./docs/art/palettes.md
If any path does not exist, locate the canonical alternative and state the resolved path.

Step 1: Select the milestone
Input argument (if provided): {{args}}

- If the user provided a milestone id/name (argument is not empty), use it.
- Otherwise, select the next milestone from ./docs/working-sessions/plan.md using this algorithm:

  A) Parse plan.md for milestone headers matching "^## Milestone <number>".
  B) A milestone is COMPLETE if the same header line contains "**Status:**" and contains the word "Completed" (case-insensitive).
     Otherwise it is INCOMPLETE (including when no status field exists).
  C) Choose the INCOMPLETE milestone with the smallest milestone number.
  D) If all milestones are COMPLETE, stop and report that no next milestone exists.

- Quote the selected milestone header line verbatim.
- Quote the milestone Objective section verbatim if present; otherwise summarize it faithfully.
- Quote/list acceptance criteria verbatim if present; otherwise derive from tasks and state they were derived.

Step 2: Plan the work (brief)
- List the smallest sequence of commits needed (prefer 1–3, but the deliverable is ONE final milestone commit).
- For each planned step, list targeted files and what you will implement.
No refactors unless required.

Step 3: Implement the milestone
- Implement the milestone end-to-end.
- Add or update at least one Scenario Runner scenario proving the milestone.
- If UI/visual behavior is affected, add/update a rendered capture scenario producing deterministic frames.

Step 4: Verify (mandatory)
Run and report:
- ./tools/ci/run-smoke.sh
- ./tools/ci/run-tests.sh
- ./tools/ci/run-spec-check.sh
- ./tools/ci/run-scenario.sh <scenario_id>
- ./tools/ci/run-scenario-rendered.sh <scenario_id> (if present; otherwise implement it if required for this milestone)
If anything fails, fix it now.

Step 5: Spec + docs hygiene
- Update spec.md for any behavior or decision changes.
- Update docs/ if you introduced new workflows/flags/commands.

Step 6: Commit + mark complete
- Create ONE commit for this milestone:
  - Message: "Milestone <N>: <Title>"
- Update the milestone header in docs/working-sessions/plan.md to include:
  **Status:** ✅ Completed (YYYY-MM-DD)

Handling blockers without questions
- If something is missing (assets, narrative, encounter lists, etc.), do not ask.
- Implement a placeholder consistent with spec.md.
- Add a NEW future milestone at the bottom of plan.md with:
  - Objective
  - Acceptance criteria
  - Owner
  - Notes on required user input (if any)
- Continue with the current milestone if still possible; otherwise complete the milestone with placeholders and proceed next run.

Final output (required)
Provide:
- Milestone completed
- Summary of changes
- Commands run + results
- Artifacts produced (captures paths)
- Spec changes (sections)
- Future milestones added (titles only)
