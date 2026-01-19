---
description: Complete the next milestone workflow
agent: godot-gameplay-engineer
---

User-provided milestone_id_or_name (may be empty): $ARGUMENTS

----- BEGIN PROMPT TEMPLATE TO EMBED IN THE COMMAND -----
You are the coding agent for Wilds of Cloverhollow.

Non-negotiable constraints:
- spec.md is the single source of truth. If you change behavior, interfaces, or decisions, update spec.md in the same change.
- Follow AGENTS.md workflows: small diffs, tests, scenario automation, spec hygiene.
- Do not depend on OS-level control of a game window. Verification must be via Scenario Runner runs and deterministic artifacts (captures + traces).
- iOS native, landscape only; macOS dev.
- 2.5D: low-poly 3D world + sprite characters; fixed 3/4 overhead camera; no rotation.
- Free analog movement; visible overworld enemies.
- Turn-based battles; pre-rendered battle backgrounds.
- Battle UI: top HUD framing up top. No cassette theming. No large themed device bar. Boxes are acceptable for v0.

Step 0: Read these files fully before writing code:
- ./spec.md
- ./AGENTS.md
- ./NOTES.md
- ./docs/working-sessions/plan.md
- ./docs/testing/scenario-runner.md
- ./docs/ui/battle-ui.md
- ./docs/art/style-lock.md
- ./docs/art/palettes.md
If any path does not exist, locate the canonical alternative and state the resolved path.

Step 1: Select the milestone (status-driven)
- If the user provided a milestone id/name, use it.
- Otherwise, select the next milestone from ./docs/working-sessions/plan.md using this algorithm:

  A) Parse plan.md for milestone headers matching "^## Milestone <number>".
  B) For each milestone header line:
     - If the same header line contains "**Status:**" and the word "Completed" (case-insensitive), treat it as COMPLETE.
     - Otherwise treat it as INCOMPLETE (including when there is no status field).
  C) Choose the INCOMPLETE milestone with the smallest milestone number.
  D) If all milestones are COMPLETE, stop and report that no next milestone exists.

- Quote the selected milestone header line verbatim.
- Quote the milestone Objective section verbatim if present; otherwise summarize it faithfully.
- Quote/list acceptance criteria verbatim if present; otherwise derive from tasks and state they were derived.

Step 2: Plan the work (brief)
- List the smallest sequence of commits needed (prefer 1–3).
- For each commit, list targeted files and what you will implement.
No refactors unless required.

Step 3: Implement the milestone
- Implement the milestone end-to-end.
- Add or update at least one Scenario Runner scenario that proves the milestone works.
- If UI/visual behavior is affected, add/update a rendered capture scenario.

Step 4: Verify (mandatory)
Run and report:
- ./tools/ci/run-smoke.sh
- ./tools/ci/run-tests.sh
- ./tools/ci/run-spec-check.sh
- ./tools/ci/run-scenario.sh <scenario_id>
- ./tools/ci/run-scenario-rendered.sh <scenario_id> (if present; otherwise implement it if required for this milestone)
If anything fails, fix it now.

Step 5: Update docs/spec
- Update spec.md for any behavior or decision changes.
- Update docs/ if you introduced new workflows/flags/commands.

Final output (required)
Provide:
- Milestone completed
- Summary of changes
- Commands run + results
- Artifacts produced (captures paths)
- Spec changes (sections)
- Follow-ups (only if non-blocking)
----- END PROMPT TEMPLATE -----
